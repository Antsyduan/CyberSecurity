"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PII_LEVELS, type PiiLevel } from "@/lib/constants";
import { Plus, Trash2 } from "lucide-react";

type ColumnDef = {
  id: string;
  name: string;
  dataType: string;
  piiLevel: PiiLevel | "";
  isNullable: boolean;
};

type TableDef = {
  id: string;
  name: string;
  schemaName: string;
  columns: ColumnDef[];
};

type MetadataEditorProps = {
  nodeId: string;
  activeTab: "tables" | "sps";
};

const DATA_TYPES = [
  "varchar", "nvarchar", "int", "bigint", "decimal", "datetime",
  "bit", "uniqueidentifier", "varbinary",
];

export function MetadataEditor({ nodeId, activeTab }: MetadataEditorProps) {
  const [tables, setTables] = useState<TableDef[]>([
    {
      id: "t1",
      name: "Users",
      schemaName: "dbo",
      columns: [
        { id: "c1", name: "Id", dataType: "uniqueidentifier", piiLevel: "", isNullable: false },
        { id: "c2", name: "Field_A", dataType: "nvarchar(50)", piiLevel: "L1", isNullable: false },
        { id: "c3", name: "Email", dataType: "nvarchar(255)", piiLevel: "L2", isNullable: true },
      ],
    },
  ]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>("t1");
  const [spContent, setSpContent] = useState("-- 預存程序 SQL 內容\nSELECT * FROM dbo.Users WHERE Id = @Id");

  const selectedTable = tables.find((t) => t.id === selectedTableId);

  const addColumn = () => {
    if (!selectedTableId) return;
    setTables((prev) =>
      prev.map((t) =>
        t.id === selectedTableId
          ? {
              ...t,
              columns: [
                ...t.columns,
                {
                  id: `c-${Date.now()}`,
                  name: "",
                  dataType: "varchar",
                  piiLevel: "",
                  isNullable: true,
                },
              ],
            }
          : t
      )
    );
  };

  const removeColumn = (colId: string) => {
    if (!selectedTableId) return;
    setTables((prev) =>
      prev.map((t) =>
        t.id === selectedTableId
          ? { ...t, columns: t.columns.filter((c) => c.id !== colId) }
          : t
      )
    );
  };

  const updateColumn = (colId: string, field: keyof ColumnDef, value: string | boolean) => {
    if (!selectedTableId) return;
    setTables((prev) =>
      prev.map((t) =>
        t.id === selectedTableId
          ? {
              ...t,
              columns: t.columns.map((c) =>
                c.id === colId ? { ...c, [field]: value } : c
              ),
            }
          : t
      )
    );
  };

  if (activeTab === "sps") {
    return (
      <div className="space-y-4">
        <div>
          <Label className="text-zinc-400">預存程序 SQL</Label>
          <textarea
            value={spContent}
            onChange={(e) => setSpContent(e.target.value)}
            className="mt-2 min-h-[280px] w-full rounded-md border border-zinc-700 bg-zinc-800/50 p-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder="-- 輸入 SP 內容..."
          />
        </div>
        <Button variant="outline" size="sm">
          產生 Migration 腳本
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-zinc-400">資料表</Label>
        <Select
          value={selectedTableId ?? ""}
          onValueChange={(v) => setSelectedTableId(v || null)}
        >
          <SelectTrigger className="mt-2 bg-zinc-800/50">
            <SelectValue placeholder="選擇資料表" />
          </SelectTrigger>
          <SelectContent>
            {tables.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.schemaName}.{t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedTable && (
        <>
          <div className="flex items-center justify-between">
            <Label className="text-zinc-400">欄位結構</Label>
            <Button variant="ghost" size="sm" onClick={addColumn}>
              <Plus className="mr-1 h-4 w-4" />
              新增欄位
            </Button>
          </div>

          <div className="space-y-3">
            {selectedTable.columns.map((col) => (
              <div
                key={col.id}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-700 bg-zinc-800/30 p-3"
              >
                <div className="flex-1 min-w-[100px]">
                  <Label className="text-xs text-zinc-500">欄位名稱</Label>
                  <Input
                    value={col.name}
                    onChange={(e) => updateColumn(col.id, "name", e.target.value)}
                    placeholder="Field_A"
                    className="mt-1"
                  />
                </div>
                <div className="w-28">
                  <Label className="text-xs text-zinc-500">型別</Label>
                  <Select
                    value={col.dataType}
                    onValueChange={(v) => updateColumn(col.id, "dataType", v)}
                  >
                    <SelectTrigger className="mt-1 bg-zinc-900/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_TYPES.map((dt) => (
                        <SelectItem key={dt} value={dt}>
                          {dt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label className="text-xs text-zinc-500">個資等級</Label>
                  <Select
                    value={col.piiLevel || "none"}
                    onValueChange={(v) =>
                      updateColumn(col.id, "piiLevel", v === "none" ? "" : (v as PiiLevel))
                    }
                  >
                    <SelectTrigger className="mt-1 bg-zinc-900/50">
                      <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-</SelectItem>
                      {PII_LEVELS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => removeColumn(col.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
