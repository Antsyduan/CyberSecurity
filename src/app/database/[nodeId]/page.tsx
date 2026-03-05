"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, Database, FileCode, BarChart3, Eye, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MigrationConfig = {
  tableIds: string[];
  viewIds: string[];
  procIds: string[];
  columnsByTable: Record<string, string[]>;
  columnsByView: Record<string, string[]>;
};

type TableDef = {
  id: string;
  name: string;
  schemaName: string;
  rowCount?: string;
  sizeMB?: string;
  columns: { id: string; name: string; dataType: string; isNullable: boolean; description?: string }[];
};

type ProcDef = {
  id: string;
  name: string;
  schemaName: string;
  paramCount: number;
  definition?: string;
  params?: { name: string; dataType: string; direction: string }[];
};

type ViewDef = TableDef;

type ConsolidatedData = {
  tables: TableDef[];
  views?: ViewDef[];
  procs: ProcDef[];
};

const PAGE_SIZE = 20;

const DEFAULT_NODE_LABELS: Record<string, string> = {
  "db-prod": "Azure DB",
  "db-backup": "Local DB (備援)",
  "db-deidentified": "Local DB (去個資)",
};

export default function DatabaseManagePage() {
  const params = useParams();
  const nodeId = params.nodeId as string;

  const [data, setData] = useState<ConsolidatedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tables" | "views" | "procs">("tables");
  const [search, setSearch] = useState("");
  const [schemaFilter, setSchemaFilter] = useState<string>("__all__");
  const [page, setPage] = useState(0);
  const [selectedTable, setSelectedTable] = useState<TableDef | null>(null);
  const [selectedView, setSelectedView] = useState<ViewDef | null>(null);
  const [selectedProc, setSelectedProc] = useState<ProcDef | null>(null);
  const [analyticsLabel, setAnalyticsLabel] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState(false);
  const [editInput, setEditInput] = useState("");
  const [nodePurpose, setNodePurpose] = useState<"backup" | "application" | null>(null);
  const [downstreamAppNodes, setDownstreamAppNodes] = useState<{ id: string; label: string }[]>([]);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);

  // 移轉勾選狀態（僅備援節點使用）
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());
  const [selectedViewIds, setSelectedViewIds] = useState<Set<string>>(new Set());
  const [selectedProcIds, setSelectedProcIds] = useState<Set<string>>(new Set());
  const [selectedColumnsByTable, setSelectedColumnsByTable] = useState<Record<string, Set<string>>>({});
  const [selectedColumnsByView, setSelectedColumnsByView] = useState<Record<string, Set<string>>>({});
  const [savingMigration, setSavingMigration] = useState(false);

  const isAnalyticsNode = nodeId?.startsWith("analytics-");
  const hasAzureData =
    nodeId === "db-prod" ||
    nodeId === "db-backup" ||
    nodeId === "db-deidentified" ||
    nodePurpose === "backup" ||
    nodePurpose === "application";

  const showMigrationUI = nodePurpose === "backup" && downstreamAppNodes.length > 0 && hasAzureData;
  const activeTarget = downstreamAppNodes.find((t) => t.id === activeTargetId) ?? downstreamAppNodes[0];

  const loadData = useCallback(() => {
    if (!hasAzureData) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/consolidated?nodeId=${nodeId}`)
      .then((res) => res.json())
      .then((d: ConsolidatedData) => setData(d))
      .catch(() => setData({ tables: [], views: [], procs: [] }))
      .finally(() => setLoading(false));
  }, [hasAzureData, nodeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (nodePurpose === "application" && activeTab !== "tables") {
      setActiveTab("tables");
      setSelectedTable(null);
      setSelectedView(null);
      setSelectedProc(null);
    }
  }, [nodePurpose, activeTab]);

  useEffect(() => {
    if (!nodeId) return;
    fetch("/api/canvas")
      .then((res) => res.json())
      .then(({ nodes, edges }: { nodes: { id: string; type?: string; data?: { label?: string; sublabel?: string; displayName?: string; purpose?: string } }[]; edges: { source: string; target: string }[] }) => {
        const nodesArr = nodes || [];
        const edgesArr = edges || [];
        const node = nodesArr.find((n: { id: string }) => n.id === nodeId);
        if (node?.data?.purpose === "backup" || node?.data?.purpose === "application") {
          setNodePurpose(node.data.purpose as "backup" | "application");
        }
        if (isAnalyticsNode && node?.data?.label) setAnalyticsLabel(node.data.label);
        // 備援節點：找出所有下游應用節點
        if (node?.data?.purpose === "backup") {
          const outEdges = edgesArr.filter((e: { source: string; target: string }) => e.source === nodeId);
          const targets: { id: string; label: string }[] = [];
          for (const e of outEdges) {
            const targetNode = nodesArr.find((n: { id: string }) => n.id === e.target);
            if (targetNode?.data?.purpose === "application") {
              const d = targetNode.data;
              const label =
                (d?.displayName as string) ||
                DEFAULT_NODE_LABELS[targetNode.id] ||
                (d?.sublabel as string) ||
                (d?.label as string) ||
                targetNode.id;
              targets.push({ id: targetNode.id, label });
            }
          }
          setDownstreamAppNodes(targets);
          setActiveTargetId((prev) => {
            if (targets.length === 0) return null;
            if (prev && targets.some((t) => t.id === prev)) return prev;
            return targets[0].id;
          });
        }
      })
      .catch(() => {});
  }, [nodeId, isAnalyticsNode]);

  // 載入既有 migration config（依目前選定的目標）
  useEffect(() => {
    if (!activeTargetId || !data) return;
    fetch(`/api/migration-config?sourceNodeId=${nodeId}&targetNodeId=${activeTargetId}`)
      .then((res) => res.json())
      .then((config: MigrationConfig) => {
        setSelectedTableIds(new Set(config.tableIds || []));
        setSelectedViewIds(new Set(config.viewIds || []));
        setSelectedProcIds(new Set(config.procIds || []));
        const byTable: Record<string, Set<string>> = {};
        for (const [tid, cols] of Object.entries(config.columnsByTable || {})) {
          byTable[tid] = new Set(cols);
        }
        setSelectedColumnsByTable(byTable);
        const byView: Record<string, Set<string>> = {};
        for (const [vid, cols] of Object.entries(config.columnsByView || {})) {
          byView[vid] = new Set(cols);
        }
        setSelectedColumnsByView(byView);
      })
      .catch(() => {});
  }, [nodeId, activeTargetId, !!data]);

  const schemaOptions = useMemo(() => {
    const schemas = new Set<string>();
    data?.tables?.forEach((t) => schemas.add(t.schemaName));
    data?.views?.forEach((v) => schemas.add(v.schemaName));
    data?.procs?.forEach((p) => schemas.add(p.schemaName));
    return Array.from(schemas).sort();
  }, [data?.tables, data?.views, data?.procs]);

  const filteredTables = useMemo(() => {
    if (!data?.tables) return [];
    let list = data.tables;
    if (schemaFilter && schemaFilter !== "__all__") {
      list = list.filter((t) => t.schemaName === schemaFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.schemaName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.tables, search, schemaFilter]);

  const filteredViews = useMemo(() => {
    if (!data?.views) return [];
    let list = data.views;
    if (schemaFilter && schemaFilter !== "__all__") {
      list = list.filter((v) => v.schemaName === schemaFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.schemaName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.views, search, schemaFilter]);

  const filteredProcs = useMemo(() => {
    if (!data?.procs) return [];
    let list = data.procs;
    if (schemaFilter && schemaFilter !== "__all__") {
      list = list.filter((p) => p.schemaName === schemaFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.schemaName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.procs, search, schemaFilter]);

  const paginatedTables = useMemo(
    () => filteredTables.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredTables, page]
  );
  const paginatedViews = useMemo(
    () => filteredViews.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredViews, page]
  );
  const paginatedProcs = useMemo(
    () => filteredProcs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredProcs, page]
  );

  const totalPages = Math.ceil(
    (activeTab === "tables" ? filteredTables.length : activeTab === "views" ? filteredViews.length : filteredProcs.length) /
      PAGE_SIZE
  );

  const nodeLabels: Record<string, string> = {
    "db-prod": "Azure DB",
    "db-backup": "Local DB (備援 · 每日完整備份)",
    "db-deidentified": "Local DB (去個資)",
    "app-icoach": "iCoach",
    "app-iprivate": "i私教",
    "analytics-tableau": "Tableau",
    "analytics-powerbi": "Power BI",
    "analytics-vibe": "Vibe Coding AI",
  };

  const displayName =
    (isAnalyticsNode && analyticsLabel) || nodeLabels[nodeId] || nodeId.replace(/^analytics-/, "").replace(/-/g, " ");

  const handleConfirmMigration = useCallback(() => {
    const targetId = activeTargetId;
    if (!targetId) return;
    setSavingMigration(true);
    const config: MigrationConfig = {
      tableIds: Array.from(selectedTableIds),
      viewIds: [],
      procIds: [],
      columnsByTable: {},
      columnsByView: {},
    };
    for (const [tid, cols] of Object.entries(selectedColumnsByTable)) {
      if (selectedTableIds.has(tid) && cols.size > 0) config.columnsByTable[tid] = Array.from(cols);
      else if (selectedTableIds.has(tid)) {
        const t = data?.tables?.find((x) => x.id === tid);
        config.columnsByTable[tid] = t?.columns?.map((c) => c.id) ?? [];
      }
    }
    fetch("/api/migration-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceNodeId: nodeId, targetNodeId: targetId, config }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Save failed");
      })
      .finally(() => setSavingMigration(false));
  }, [nodeId, activeTargetId, selectedTableIds, selectedColumnsByTable, data]);

  const toggleTable = useCallback((id: string, checked: boolean) => {
    setSelectedTableIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    if (!checked) {
      setSelectedColumnsByTable((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, []);

  const toggleView = useCallback((id: string, checked: boolean) => {
    setSelectedViewIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    if (!checked) {
      setSelectedColumnsByView((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, []);

  const toggleProc = useCallback((id: string, checked: boolean) => {
    setSelectedProcIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleColumn = useCallback(
    (parentId: string, colId: string, checked: boolean, isView: boolean, allColumnIds?: string[]) => {
      const setter = isView ? setSelectedColumnsByView : setSelectedColumnsByTable;
      setter((prev) => {
        const next = { ...prev };
        let set = new Set(next[parentId] || []);
        if (set.size === 0 && allColumnIds && !checked) {
          set = new Set(allColumnIds.filter((id) => id !== colId));
        } else {
          if (checked) set.add(colId);
          else set.delete(colId);
        }
        next[parentId] = set;
        return next;
      });
    },
    []
  );

  const selectAllColumns = useCallback((parentId: string, columns: { id: string }[], isView: boolean) => {
    const setter = isView ? setSelectedColumnsByView : setSelectedColumnsByTable;
    setter((prev) => {
      const next = { ...prev };
      next[parentId] = new Set(columns.map((c) => c.id));
      return next;
    });
  }, []);

  const selectAllInCurrentTab = useCallback(() => {
    if (activeTab === "tables") {
      setSelectedTableIds((prev) => {
        const next = new Set(prev);
        filteredTables.forEach((t) => next.add(t.id));
        return next;
      });
    } else if (activeTab === "views") {
      setSelectedViewIds((prev) => {
        const next = new Set(prev);
        filteredViews.forEach((v) => next.add(v.id));
        return next;
      });
    } else {
      setSelectedProcIds((prev) => {
        const next = new Set(prev);
        filteredProcs.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }, [activeTab, filteredTables, filteredViews, filteredProcs]);

  const selectNoneInCurrentTab = useCallback(() => {
    if (activeTab === "tables") {
      setSelectedTableIds((prev) => {
        const next = new Set(prev);
        filteredTables.forEach((t) => next.delete(t.id));
        return next;
      });
      setSelectedColumnsByTable((prev) => {
        const next = { ...prev };
        filteredTables.forEach((t) => delete next[t.id]);
        return next;
      });
    } else if (activeTab === "views") {
      setSelectedViewIds((prev) => {
        const next = new Set(prev);
        filteredViews.forEach((v) => next.delete(v.id));
        return next;
      });
      setSelectedColumnsByView((prev) => {
        const next = { ...prev };
        filteredViews.forEach((v) => delete next[v.id]);
        return next;
      });
    } else {
      setSelectedProcIds((prev) => {
        const next = new Set(prev);
        filteredProcs.forEach((p) => next.delete(p.id));
        return next;
      });
    }
  }, [activeTab, filteredTables, filteredViews, filteredProcs]);

  const selectCurrentPage = useCallback(() => {
    if (activeTab === "tables") {
      setSelectedTableIds((prev) => {
        const next = new Set(prev);
        paginatedTables.forEach((t) => next.add(t.id));
        return next;
      });
    } else if (activeTab === "views") {
      setSelectedViewIds((prev) => {
        const next = new Set(prev);
        paginatedViews.forEach((v) => next.add(v.id));
        return next;
      });
    } else {
      setSelectedProcIds((prev) => {
        const next = new Set(prev);
        paginatedProcs.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }, [activeTab, paginatedTables, paginatedViews, paginatedProcs]);

  const handleSaveAnalyticsLabel = useCallback(() => {
    if (!nodeId || !editInput.trim()) {
      setEditingLabel(false);
      return;
    }
    fetch("/api/canvas")
      .then((res) => res.json())
      .then(({ nodes, edges }) => {
        const updated = (nodes || []).map((n: { id: string; data?: Record<string, unknown> }) =>
          n.id === nodeId ? { ...n, data: { ...n.data, label: editInput.trim() } } : n
        );
        return fetch("/api/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodes: updated, edges }),
        });
      })
      .then(() => {
        setAnalyticsLabel(editInput.trim());
        setEditingLabel(false);
      })
      .catch(() => setEditingLabel(false));
  }, [nodeId, editInput]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {showMigrationUI && (
              <Button
                size="sm"
                onClick={handleConfirmMigration}
                disabled={savingMigration}
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                <Check className="mr-2 h-4 w-4" />
                {savingMigration ? "儲存中..." : "確認移轉設定"}
              </Button>
            )}
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回架構圖
              </Button>
            </Link>
            <div className="h-6 w-px bg-zinc-700" />
            <div>
              <h1 className="text-lg font-semibold">
                {displayName} · 維運管理
              </h1>
              {nodePurpose === "backup" && (
                <p className="text-xs text-zinc-500 mt-0.5">備援與 Azure DB 結構一致</p>
              )}
              {nodePurpose === "application" && nodeId === "db-deidentified" && data && (data.tables.length > 0 || (data.views?.length ?? 0) > 0 || data.procs.length > 0) && (
                <p className="text-xs text-zinc-500 mt-0.5">依備援節點移轉設定顯示</p>
              )}
              {showMigrationUI && (
                <p className="text-xs text-amber-400/90 mt-0.5">
                  勾選要移轉的項目，指定目標後點選確認套用
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-zinc-500">
            載入中...
          </div>
        ) : isAnalyticsNode ? (
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-12 text-center text-zinc-400">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-emerald-500/70" />
            {editingLabel ? (
              <div className="mx-auto flex max-w-xs items-center gap-2">
                <Input
                  value={editInput}
                  onChange={(e) => setEditInput(e.target.value)}
                  placeholder="分析工具名稱"
                  className="bg-zinc-800 text-zinc-100"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveAnalyticsLabel()}
                />
                <Button size="sm" onClick={handleSaveAnalyticsLabel}>
                  儲存
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingLabel(false)}>
                  取消
                </Button>
              </div>
            ) : (
              <>
                <p className="text-lg font-medium text-zinc-300">{displayName}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-zinc-500 hover:text-zinc-300"
                  onClick={() => {
                    setEditInput(displayName);
                    setEditingLabel(true);
                  }}
                >
                  編輯名稱
                </Button>
              </>
            )}
            <p className="mt-4 text-sm">分析工具節點 · 無資料庫結構</p>
            <p className="mt-1 text-xs text-zinc-500">此節點代表 BI 或分析系統，接收來自去個資機的資料</p>
          </div>
        ) : !hasAzureData ? (
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-12 text-center text-zinc-400">
            <Database className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>此節點尚無匯入的資料庫結構</p>
            <p className="mt-2 text-sm">請點選 Azure DB 或備援節點以檢視維運資料</p>
          </div>
        ) : nodePurpose === "application" && data && data.tables.length === 0 && data.views?.length === 0 && data.procs.length === 0 ? (
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-12 text-center text-zinc-400">
            <Database className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>尚未設定移轉項目</p>
            <p className="mt-2 text-sm">請在備援節點勾選要移轉的資料表、View、預存程序與欄位，點選「確認移轉設定」後，此處將顯示已設定的結構</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
            <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[32rem]">
              {showMigrationUI && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 space-y-3">
                  <div className="text-sm font-medium text-amber-200/90">移轉設定</div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    備援資料庫維持完整備份（含 Table、View、預存程序）。僅移轉至應用 DB 時僅含資料表。
                  </p>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">移轉目標</label>
                    {downstreamAppNodes.length > 1 ? (
                      <Select value={activeTargetId ?? ""} onValueChange={(v) => setActiveTargetId(v)}>
                        <SelectTrigger className="bg-zinc-800/80 border-zinc-600">
                          <SelectValue placeholder="選擇目標" />
                        </SelectTrigger>
                        <SelectContent>
                          {downstreamAppNodes.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-zinc-300">{activeTarget?.label}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    placeholder="搜尋..."
                    className="pl-9 bg-zinc-800/50"
                  />
                </div>
              </div>

              {showMigrationUI && schemaOptions.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 shrink-0">Schema:</span>
                  <Select value={schemaFilter} onValueChange={(v) => { setSchemaFilter(v); setPage(0); }}>
                    <SelectTrigger className="flex-1 h-8 text-xs bg-zinc-800/50 border-zinc-600">
                      <SelectValue placeholder="全部" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">全部</SelectItem>
                      {schemaOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showMigrationUI && (
                <div className="flex flex-wrap gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs border-zinc-600" onClick={selectAllInCurrentTab}>
                    全選
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs border-zinc-600" onClick={selectNoneInCurrentTab}>
                    全不選
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs border-zinc-600" onClick={selectCurrentPage}>
                    選取本頁
                  </Button>
                </div>
              )}

              {showMigrationUI && (
                <div className="text-xs text-zinc-400 py-1 px-2 rounded bg-zinc-800/50">
                  已選：{selectedTableIds.size} 表（僅移轉資料表）
                </div>
              )}

              <div className="flex flex-shrink-0 overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-800/30 p-1">
                <button
                  onClick={() => {
                    setActiveTab("tables");
                    setPage(0);
                    setSelectedTable(null);
                    setSelectedView(null);
                    setSelectedProc(null);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === "tables"
                      ? "bg-cyan-600/20 text-cyan-400"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Database className="h-4 w-4" />
                  資料表 ({data?.tables?.length ?? 0})
                </button>
                {nodePurpose !== "application" && (
                  <>
                    <button
                      onClick={() => {
                        setActiveTab("views");
                        setPage(0);
                        setSelectedTable(null);
                        setSelectedView(null);
                        setSelectedProc(null);
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        activeTab === "views"
                          ? "bg-cyan-600/20 text-cyan-400"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Eye className="h-4 w-4" />
                      View ({data?.views?.length ?? 0})
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("procs");
                        setPage(0);
                        setSelectedTable(null);
                        setSelectedView(null);
                        setSelectedProc(null);
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        activeTab === "procs"
                          ? "bg-cyan-600/20 text-cyan-400"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <FileCode className="h-4 w-4" />
                      預存程序 ({data?.procs?.length ?? 0})
                    </button>
                  </>
                )}
              </div>

              <div className="flex-1 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800/30">
                {activeTab === "tables" ? (
                  <ul className="divide-y divide-zinc-700">
                    {paginatedTables.map((t) => (
                      <li key={t.id}>
                        <div
                          className={`flex items-center gap-2 w-full min-w-0 px-4 py-3 text-left text-sm hover:bg-zinc-700/50 cursor-pointer ${
                            selectedTable?.id === t.id
                              ? "bg-cyan-600/20 text-cyan-400"
                              : ""
                          }`}
                          onClick={() => {
                            setSelectedTable(t);
                            setSelectedView(null);
                            setSelectedProc(null);
                          }}
                        >
                          {showMigrationUI && (
                            <input
                              type="checkbox"
                              checked={selectedTableIds.has(t.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleTable(t.id, e.target.checked);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0 rounded border-zinc-600 bg-zinc-800 text-cyan-500 focus:ring-cyan-500"
                            />
                          )}
                          <div className="min-w-0 flex-1 break-words">
                            <span className="font-medium">{t.name}</span>
                            <span className="text-zinc-500"> · {t.schemaName} · {t.columns?.length ?? 0} 欄</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : activeTab === "views" ? (
                  <ul className="divide-y divide-zinc-700">
                    {paginatedViews.map((v) => (
                      <li key={v.id}>
                        <div
                          className={`flex items-center gap-2 w-full min-w-0 px-4 py-3 text-left text-sm hover:bg-zinc-700/50 cursor-pointer ${
                            selectedView?.id === v.id
                              ? "bg-cyan-600/20 text-cyan-400"
                              : ""
                          }`}
                          onClick={() => {
                            setSelectedView(v);
                            setSelectedTable(null);
                            setSelectedProc(null);
                          }}
                        >
                          <div className="min-w-0 flex-1 break-words">
                            <span className="font-medium">{v.name}</span>
                            <span className="text-zinc-500"> · {v.schemaName} · {v.columns?.length ?? 0} 欄</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="divide-y divide-zinc-700">
                    {paginatedProcs.map((p) => (
                      <li key={p.id}>
                        <div
                          className={`flex items-center gap-2 w-full min-w-0 px-4 py-3 text-left text-sm hover:bg-zinc-700/50 cursor-pointer ${
                            selectedProc?.id === p.id
                              ? "bg-cyan-600/20 text-cyan-400"
                              : ""
                          }`}
                          onClick={() => {
                            setSelectedProc(p);
                            setSelectedTable(null);
                            setSelectedView(null);
                          }}
                        >
                          <div className="min-w-0 flex-1 break-words">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-zinc-500"> · {p.paramCount} 參數</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-zinc-700 px-4 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      上一頁
                    </Button>
                    <span className="text-xs text-zinc-500">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    >
                      下一頁
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800/30 p-4 flex flex-col sm:p-6">
              {selectedTable ? (
                <div className="flex-1">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      {selectedTable.schemaName}.{selectedTable.name}
                    </h2>
                    {showMigrationUI && selectedTable.columns && selectedTable.columns.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-zinc-400 border-zinc-600"
                        onClick={() => selectAllColumns(selectedTable.id, selectedTable.columns, false)}
                      >
                        全選欄位
                      </Button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-600 text-left text-zinc-400">
                          {showMigrationUI && <th className="pb-3 pr-2 w-8 font-medium"></th>}
                          <th className="pb-3 pr-4 font-medium">欄位</th>
                          <th className="pb-3 pr-4 font-medium">型別</th>
                          <th className="pb-3 pr-4 font-medium">可為 NULL</th>
                          <th className="pb-3 font-medium">說明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedTable.columns || []).map((col) => (
                          <tr
                            key={col.id}
                            className="border-b border-zinc-700/50"
                          >
                            {showMigrationUI && (
                              <td className="py-2 pr-2">
                                <input
                                  type="checkbox"
                                  checked={
                                    selectedTableIds.has(selectedTable.id) &&
                                    (!selectedColumnsByTable[selectedTable.id] ||
                                      selectedColumnsByTable[selectedTable.id].size === 0 ||
                                      selectedColumnsByTable[selectedTable.id].has(col.id))
                                  }
                                  onChange={(e) =>
                                    toggleColumn(
                                      selectedTable.id,
                                      col.id,
                                      e.target.checked,
                                      false,
                                      selectedTable.columns?.map((c) => c.id)
                                    )
                                  }
                                  className="rounded border-zinc-600 bg-zinc-800 text-cyan-500 focus:ring-cyan-500"
                                />
                              </td>
                            )}
                            <td className="py-2 pr-4 font-mono">{col.name}</td>
                            <td className="py-2 pr-4 text-zinc-400">{col.dataType}</td>
                            <td className="py-2 pr-4 text-zinc-400">
                              {col.isNullable ? "是" : "否"}
                            </td>
                            <td className="py-2 text-zinc-500">
                              {col.description || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : selectedView ? (
                <div className="flex-1">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      {selectedView.schemaName}.{selectedView.name}
                    </h2>
                    {showMigrationUI && selectedView.columns && selectedView.columns.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-zinc-400 border-zinc-600"
                        onClick={() => selectAllColumns(selectedView.id, selectedView.columns, true)}
                      >
                        全選欄位
                      </Button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-600 text-left text-zinc-400">
                          {showMigrationUI && <th className="pb-3 pr-2 w-8 font-medium"></th>}
                          <th className="pb-3 pr-4 font-medium">欄位</th>
                          <th className="pb-3 pr-4 font-medium">型別</th>
                          <th className="pb-3 pr-4 font-medium">可為 NULL</th>
                          <th className="pb-3 font-medium">說明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedView.columns || []).map((col) => (
                          <tr
                            key={col.id}
                            className="border-b border-zinc-700/50"
                          >
                            {showMigrationUI && (
                              <td className="py-2 pr-2">
                                <input
                                  type="checkbox"
                                  checked={
                                    selectedViewIds.has(selectedView.id) &&
                                    (!selectedColumnsByView[selectedView.id] ||
                                      selectedColumnsByView[selectedView.id].size === 0 ||
                                      selectedColumnsByView[selectedView.id].has(col.id))
                                  }
                                  onChange={(e) =>
                                    toggleColumn(
                                      selectedView.id,
                                      col.id,
                                      e.target.checked,
                                      true,
                                      selectedView.columns?.map((c) => c.id)
                                    )
                                  }
                                  className="rounded border-zinc-600 bg-zinc-800 text-cyan-500 focus:ring-cyan-500"
                                />
                              </td>
                            )}
                            <td className="py-2 pr-4 font-mono">{col.name}</td>
                            <td className="py-2 pr-4 text-zinc-400">{col.dataType}</td>
                            <td className="py-2 pr-4 text-zinc-400">
                              {col.isNullable ? "是" : "否"}
                            </td>
                            <td className="py-2 text-zinc-500">
                              {col.description || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : selectedProc ? (
                <div>
                  <h2 className="mb-4 text-lg font-semibold">
                    {selectedProc.schemaName}.{selectedProc.name}
                  </h2>
                  <div className="mb-4">
                    <h3 className="mb-2 text-sm font-medium text-zinc-400">
                      參數
                    </h3>
                    <div className="space-y-2">
                      {(selectedProc.params || []).map((pa, i) => (
                        <div
                          key={i}
                          className="flex gap-4 rounded bg-zinc-800/50 px-3 py-2 font-mono text-sm"
                        >
                          <span className="text-cyan-400">{pa.name}</span>
                          <span className="text-zinc-500">{pa.dataType}</span>
                          <span className="text-zinc-500">{pa.direction}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-zinc-500">
                  請從左側選擇資料表、View 或預存程序
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
