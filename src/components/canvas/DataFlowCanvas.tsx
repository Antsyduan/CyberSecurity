"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { resolveCollisions } from "@/lib/resolveCollisions";
import { getLayoutedElements } from "@/lib/dagreLayout";
import { AppNode, DatabaseNode, AnalyticsNode } from "./nodes";
import { JobEdge } from "./JobEdge";
import { FirewallLayer } from "./FirewallLayer";
import { FirewallSettings } from "./FirewallSettings";
import { SecurityLegend } from "./SecurityLegend";
import { AddNodeDropdown } from "./AddNodeDropdown";
import type { NodeTypeToAdd, DatabasePurpose } from "./AddNodeDropdown";
import { NodeEditPanel } from "@/components/sidebar/NodeEditPanel";
import { Button } from "@/components/ui/button";
import { Trash2, LayoutGrid } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: NodeTypes = {
  app: AppNode as any,
  database: DatabaseNode as any,
  analytics: AnalyticsNode as any,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes: EdgeTypes = {
  job: JobEdge as any,
};

// 初始節點與邊緣（對應概念圖），節點間距預留連接線顯示空間
const initialNodes: Node[] = [
  { id: "app-icoach", type: "app", position: { x: 80, y: 80 }, data: { label: "iCoach" }, className: "nopan" },
  { id: "app-iprivate", type: "app", position: { x: 80, y: 220 }, data: { label: "i私教" }, className: "nopan" },
  {
    id: "db-prod",
    type: "database",
    position: { x: 320, y: 150 },
    data: { label: "SQL Server", sublabel: "Azure DB", purpose: "application" as const },
    className: "nopan",
  },
  {
    id: "db-backup",
    type: "database",
    position: { x: 560, y: 150 },
    data: { label: "SQL Server", sublabel: "Local DB", purpose: "backup" as const },
    className: "nopan",
  },
  {
    id: "db-deidentified",
    type: "database",
    position: { x: 800, y: 150 },
    data: { label: "SQL Server", sublabel: "Local DB", purpose: "application" as const },
    className: "nopan",
  },
  {
    id: "analytics-tableau",
    type: "analytics",
    position: { x: 1040, y: 60 },
    data: { label: "Tableau" },
    className: "nopan",
  },
  {
    id: "analytics-powerbi",
    type: "analytics",
    position: { x: 1040, y: 150 },
    data: { label: "Power BI" },
    className: "nopan",
  },
  {
    id: "analytics-vibe",
    type: "analytics",
    position: { x: 1040, y: 240 },
    data: { label: "Vibe Coding AI" },
    className: "nopan",
  },
];

const initialEdges: Edge[] = [
  {
    id: "e1",
    source: "app-icoach",
    target: "db-prod",
    type: "job",
    data: { connectionType: "storedProcedure", hasMasking: false },
  },
  {
    id: "e2",
    source: "app-iprivate",
    target: "db-prod",
    type: "job",
    data: { connectionType: "storedProcedure", hasMasking: false },
  },
  {
    id: "e3",
    source: "db-prod",
    target: "db-backup",
    type: "job",
    data: { connectionType: "job", hasMasking: false },
  },
  {
    id: "e4",
    source: "db-backup",
    target: "db-deidentified",
    type: "job",
    data: { connectionType: "job", hasMasking: false }, // 模擬：無 Masking 時觸發 PII 流向告警
  },
  {
    id: "e5",
    source: "db-deidentified",
    target: "analytics-tableau",
    type: "job",
    data: { connectionType: "job", hasMasking: false },
  },
  {
    id: "e6",
    source: "db-deidentified",
    target: "analytics-powerbi",
    type: "job",
    data: { connectionType: "job", hasMasking: false },
  },
  {
    id: "e7",
    source: "db-deidentified",
    target: "analytics-vibe",
    type: "job",
    data: { connectionType: "job", hasMasking: false },
  },
];

// 正式機有 PII 欄位時，備援→去個資路徑需有 Masking，否則告警
const HAS_PII_IN_PRODUCTION = true;

function generateNodeId(type: string): string {
  return `${type}-${Date.now()}`;
}

const SAVE_DEBOUNCE_MS = 500;

export function DataFlowCanvas() {
  const [loaded, setLoaded] = useState(false);
  const [lockLoaded, setLockLoaded] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [firewallConfig, setFirewallConfig] = useState<{
    firewalls: { id: string; position: number; label?: string }[];
    zoneLabels: string[];
  } | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactFlowRef = useRef<{ fitView?: (opts?: { padding?: number }) => void } | null>(null);
  const hasFittedRef = useRef(false);
  const [nodeStats, setNodeStats] = useState<Record<string, { tables: number; views: number; procs: number }>>({});
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    fetch("/api/canvas-node-stats")
      .then((res) => res.json())
      .then((data: Record<string, { tables: number; views: number; procs: number }>) => {
        setNodeStats(data ?? {});
      })
      .catch(() => {});
  }, [loaded, nodes, edges]);

  useEffect(() => {
    fetch("/api/canvas/firewall")
      .then((res) => res.json())
      .then((data) => {
        if (data?.firewalls && Array.isArray(data.firewalls) && data.firewalls.length >= 1) {
          setFirewallConfig({
            firewalls: data.firewalls,
            zoneLabels: data.zoneLabels ?? ["正式機 (Production)", "備援機 (Backup)", "內部去個資機 (De-identified)"],
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/canvas/lock")
      .then((res) => res.json())
      .then(({ locked }) => {
        setIsLocked(Boolean(locked));
        setLockLoaded(true);
      })
      .catch(() => setLockLoaded(true));
  }, []);

  useEffect(() => {
    fetch("/api/canvas")
      .then((res) => res.json())
      .then(({ nodes: savedNodes, edges: savedEdges }) => {
        if (Array.isArray(savedNodes) && savedNodes.length > 0) {
          setNodes(savedNodes);
        }
        if (Array.isArray(savedEdges) && savedEdges.length > 0) {
          setEdges(savedEdges);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded || hasFittedRef.current || !reactFlowRef.current) return;
    hasFittedRef.current = true;
    requestAnimationFrame(() => {
      reactFlowRef.current?.fitView?.({ padding: 0.2 });
    });
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      fetch("/api/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      }).catch(() => {});
      saveTimeoutRef.current = null;
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [loaded, nodes, edges]);

  const handleAddNode = useCallback(
    (type: NodeTypeToAdd, options?: { purpose?: DatabasePurpose }) => {
      const id = generateNodeId(type);
      const maxX = Math.max(...nodes.map((n) => n.position.x), 0);
      const maxY = Math.max(...nodes.map((n) => n.position.y), 0);
      const basePosition = { x: maxX + 140, y: maxY + 80 };

      const baseNode = {
        id,
        position: basePosition,
        className: "nopan" as const,
      };

      if (type === "app") {
        setNodes((nds) => [
          ...nds,
          { ...baseNode, type: "app", data: { label: "新應用" } },
        ]);
      } else if (type === "database") {
        setNodes((nds) => [
          ...nds,
          {
            ...baseNode,
            type: "database",
            data: {
              label: "SQL Server",
              sublabel: "Local DB",
              purpose: options?.purpose ?? "application",
            },
          },
        ]);
      } else {
        setNodes((nds) => [
          ...nds,
          { ...baseNode, type: "analytics", data: { label: "新分析工具" } },
        ]);
      }
    },
    [nodes, setNodes]
  );

  // 含 PII 的節點：正式機 + 所有備援目的節點
  const piiSourceNodeIds = useMemo(() => {
    const ids = new Set<string>(["db-prod", "db-backup"]);
    nodes.forEach((n) => {
      if (n.type === "database" && (n.data as { purpose?: string })?.purpose === "backup") {
        ids.add(n.id);
      }
    });
    return ids;
  }, [nodes]);

  // 流向驗證：依 SQL Server 目的區分
  // - Azure→備援：應與來源一致，有 Masking 才有問題（亮燈）
  // - 備援→應用：應有 Masking，沒有才有問題（亮燈）
  const alertEdges = useMemo(() => {
    if (!HAS_PII_IN_PRODUCTION) return [];
    const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
    return edges
      .filter((e) => piiSourceNodeIds.has(e.source))
      .map((e) => {
        const hasMasking = e.data?.hasMasking ?? false;
        const targetNode = nodeMap[e.target];
        const isDatabase = targetNode?.type?.toLowerCase() === "database";
        const targetPurpose = isDatabase
          ? ((targetNode!.data as { purpose?: "backup" | "application" })?.purpose ?? "application")
          : undefined;
        if (targetPurpose === "backup" && hasMasking) {
          return { id: e.id, reason: "backupPath" as const };
        }
        if (targetPurpose === "application" && !hasMasking) {
          return { id: e.id, reason: "needMasking" as const };
        }
        return { id: e.id, reason: null as "backupPath" | "needMasking" | null };
      })
      .filter((x): x is { id: string; reason: "backupPath" | "needMasking" } => x.reason != null);
  }, [edges, nodes, piiSourceNodeIds]);

  const alertEdgeIds = useMemo(() => alertEdges.map((e) => e.id), [alertEdges]);
  const alertEdgeReasons = useMemo(
    () => Object.fromEntries(alertEdges.map((e) => [e.id, e.reason])),
    [alertEdges]
  );

  const alertNodeIds = useMemo(
    () =>
      HAS_PII_IN_PRODUCTION
        ? [...new Set(edges.filter((e) => alertEdgeIds.includes(e.id)).map((e) => e.target))]
        : [],
    [edges, alertEdgeIds]
  );

  const alertNodeReasons = useMemo(() => {
    const reasons: Record<string, "backupPath" | "needMasking"> = {};
    for (const e of edges) {
      if (alertEdgeReasons[e.id]) {
        reasons[e.target] = alertEdgeReasons[e.id];
      }
    }
    return reasons;
  }, [edges, alertEdgeReasons]);

  const handleUpdateEdgeMasking = useCallback(
    (edgeId: string, hasMasking: boolean) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId ? { ...e, data: { ...e.data, hasMasking } } : e
        )
      );
    },
    [setEdges]
  );

  const handleUpdateEdgeConnectionType = useCallback(
    (edgeId: string, connectionType: "job" | "storedProcedure") => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId ? { ...e, data: { ...e.data, connectionType } } : e
        )
      );
    },
    [setEdges]
  );

  const nodesWithAlert = useMemo(
    () =>
      nodes.map((n) => {
        const baseData = {
          ...n.data,
          hasAlert: alertNodeIds.includes(n.id),
          alertReason: alertNodeReasons[n.id],
        };
        const stats = n.type === "database" ? nodeStats[n.id] : undefined;
        if (stats) {
          return {
            ...n,
            data: {
              ...baseData,
              tableCount: stats.tables,
              viewCount: stats.views,
              procCount: stats.procs,
            },
          };
        }
        return { ...n, data: baseData };
      }),
    [nodes, alertNodeIds, alertNodeReasons, nodeStats]
  );

  const edgesWithAlert = useMemo(
    () =>
      edges.map((e) => {
        const isBackupPath = alertEdgeReasons[e.id] === "backupPath";
        const hasMasking = e.data?.hasMasking ?? false;
        const canUpdateMasking =
          e.data?.connectionType === "job" &&
          (isBackupPath ? hasMasking : true);
        return {
          ...e,
          data: {
            ...e.data,
            hasAlert: alertEdgeIds.includes(e.id),
            alertReason: alertEdgeReasons[e.id],
            onUpdateMasking: canUpdateMasking
              ? (value: boolean) => handleUpdateEdgeMasking(e.id, value)
              : undefined,
            onUpdateConnectionType: !isLocked
              ? (type: "job" | "storedProcedure") =>
                  handleUpdateEdgeConnectionType(e.id, type)
              : undefined,
          },
        };
      }),
    [
      edges,
      alertEdgeIds,
      alertEdgeReasons,
      handleUpdateEdgeMasking,
      handleUpdateEdgeConnectionType,
      isLocked,
    ]
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "job",
            data: { connectionType: "job" as const, hasMasking: false },
          },
          eds
        )
      ),
    [setEdges]
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      if (deleted.length === 0) return;
      const deletedIds = new Set(deleted.map((n) => n.id));
      setNodes((nds) => nds.filter((n) => !deletedIds.has(n.id)));
      setEdges((eds) =>
        eds.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target))
      );
    },
    [setNodes, setEdges]
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (deleted.length === 0) return;
      const deletedIds = new Set(deleted.map((e) => e.id));
      setEdges((eds) => eds.filter((e) => !deletedIds.has(e.id)));
    },
    [setEdges]
  );

  const selectedNodeIds = useMemo(
    () => new Set(nodes.filter((n) => n.selected).map((n) => n.id)),
    [nodes]
  );
  const selectedEdgeIds = useMemo(
    () => new Set(edges.filter((e) => e.selected).map((e) => e.id)),
    [edges]
  );
  const hasSelection = selectedNodeIds.size > 0 || selectedEdgeIds.size > 0;

  const handleDeleteSelected = useCallback(() => {
    if (!hasSelection || isLocked) return;
    const nodesToDelete = nodes.filter((n) => n.selected);
    const edgesToDelete = edges.filter((e) => e.selected);
    if (nodesToDelete.length > 0) onNodesDelete(nodesToDelete);
    if (edgesToDelete.length > 0) onEdgesDelete(edgesToDelete);
  }, [hasSelection, isLocked, nodes, edges, onNodesDelete, onEdgesDelete]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Partial<Node["data"]>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      );
    },
    [setNodes]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, _node: Node) => {
      setNodes((nds) =>
        resolveCollisions(nds, {
          margin: 50,
          fixedNodeId: _node.id,
        })
      );
    },
    [setNodes]
  );

  const handleAutoLayout = useCallback(() => {
    if (isLocked) return;
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      "LR"
    );
    const resolvedNodes = resolveCollisions(layoutedNodes, {
      margin: 45,
      overlapThreshold: 2,
    });
    setNodes(resolvedNodes);
    setEdges(layoutedEdges);
    requestAnimationFrame(() => {
      reactFlowRef.current?.fitView?.({ padding: 0.2 });
    });
  }, [nodes, edges, setNodes, setEdges, isLocked]);

  const handleLockChange = useCallback((interactive: boolean) => {
    if (!lockLoaded) return;
    const locked = !interactive;
    setIsLocked(locked);
    fetch("/api/canvas/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked }),
    }).catch(() => {});
  }, [lockLoaded]);

  const handleFirewallSave = useCallback(
    async (config: { firewalls: { id: string; position: number; label?: string }[]; zoneLabels: string[] }) => {
      setFirewallConfig(config);
      await fetch("/api/canvas/firewall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      }).catch(() => {});
    },
    []
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="relative z-50 flex shrink-0 flex-col gap-3 border-b border-zinc-800/90 bg-zinc-900/90 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6 shadow-[0_1px_0_0_rgba(255,255,255,0.03)]">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <h1 className="text-[1.125rem] font-semibold tracking-tight text-zinc-100">
            資料庫架構管理平台
          </h1>
          <AddNodeDropdown onAddNode={handleAddNode} />
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-zinc-600 bg-zinc-800/80 text-zinc-200 hover:bg-red-900/50 hover:text-red-400 hover:border-red-800 disabled:opacity-50"
            disabled={!hasSelection || isLocked}
            onClick={handleDeleteSelected}
            title="刪除選取的節點與連線 (或按 Del)"
          >
            <Trash2 className="h-4 w-4" />
            刪除選取
          </Button>
          <FirewallSettings
            config={firewallConfig ?? { firewalls: [{ id: "fw1", position: 33, label: "Firewall 1" }, { id: "fw2", position: 66, label: "Firewall 2" }], zoneLabels: ["正式機 (Production)", "備援機 (Backup)", "內部去個資機 (De-identified)"] }}
            onSave={handleFirewallSave}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[0.875rem]">
          <span className="flex items-center gap-2 text-zinc-400">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-500" />
            僅儲存 Schema 與流向
          </span>
          <span className="hidden text-zinc-500 sm:inline">拖曳節點圓點建立連線 · 選取後 Del 刪除 · 滾輪縮放 · 拖曳空白處平移</span>
        </div>
      </header>
      <main className="relative flex-1 overflow-hidden">
        {!lockLoaded ? (
          <div className="flex h-full items-center justify-center bg-zinc-950">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          </div>
        ) : (
        <ReactFlow
          onInit={(instance) => { reactFlowRef.current = instance; }}
          nodes={nodesWithAlert}
          edges={edgesWithAlert}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          isValidConnection={() => true}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          deleteKeyCode={["Backspace", "Delete"]}
          nodesConnectable={!isLocked}
          elementsSelectable={!isLocked}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          className="bg-zinc-950/99"
          minZoom={0.2}
          maxZoom={1.5}
          panOnDrag
          nodesDraggable={!isLocked}
          zoomOnScroll
          panOnScroll={false}
        >
          <Background color="#27272a" gap={20} size={1} />
          <Controls
            position="bottom-left"
            className={`!bg-zinc-900 !border-zinc-700 !text-zinc-200 ${isLocked ? "controls-locked" : ""}`}
            onInteractiveChange={handleLockChange}
          />
          <Panel position="top-right" className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-zinc-600/80 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700/95 hover:border-zinc-500 transition-colors duration-200 disabled:opacity-50"
              disabled={isLocked}
              onClick={handleAutoLayout}
              title="依連線關係自動排列節點"
            >
              <LayoutGrid className="h-4 w-4" />
              自動排版
            </Button>
          </Panel>
          <FirewallLayer config={firewallConfig} />
        </ReactFlow>
        )}
        <SecurityLegend />
        {selectedNode && (
          <NodeEditPanel
            node={nodes.find((n) => n.id === selectedNode.id) ?? selectedNode}
            onUpdate={handleNodeUpdate}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </main>
    </div>
  );
}
