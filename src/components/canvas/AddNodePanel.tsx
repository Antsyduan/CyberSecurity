"use client";

import { Plus, LayoutGrid, Database, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type NodeTypeToAdd = "app" | "database" | "analytics";

type AddNodePanelProps = {
  onAddNode: (type: NodeTypeToAdd) => void;
};

const NODE_OPTIONS: { type: NodeTypeToAdd; label: string; icon: React.ReactNode }[] = [
  { type: "app", label: "應用程式", icon: <LayoutGrid className="h-4 w-4" /> },
  { type: "database", label: "SQL Server", icon: <Database className="h-4 w-4" /> },
  { type: "analytics", label: "分析工具", icon: <BarChart3 className="h-4 w-4" /> },
];

export function AddNodePanel({ onAddNode }: AddNodePanelProps) {
  return (
    <div className="absolute top-4 left-4 z-10 rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-xl backdrop-blur">
      <div className="flex items-center gap-2 border-b border-zinc-700 pb-2 mb-2">
        <Plus className="h-4 w-4 text-cyan-400" />
        <span className="text-sm font-medium text-zinc-200">新增物件</span>
      </div>
      <div className="flex flex-col gap-1">
        {NODE_OPTIONS.map(({ type, label, icon }) => (
          <Button
            key={type}
            variant="ghost"
            size="sm"
            className="justify-start gap-2 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
            onClick={() => onAddNode(type)}
          >
            {icon}
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
