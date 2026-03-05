"use client";

import { useState, useEffect } from "react";
import type { Node } from "@xyflow/react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetadataEditor } from "./MetadataEditor";

type MetadataSidebarProps = {
  node: Node;
  onUpdate?: (nodeId: string, data: Partial<Node["data"]>) => void;
  onClose: () => void;
};

export function MetadataSidebar({ node, onUpdate, onClose }: MetadataSidebarProps) {
  const [activeTab, setActiveTab] = useState<"tables" | "sps">("tables");
  const [label, setLabel] = useState(String(node.data?.label ?? ""));
  const [sublabel, setSublabel] = useState(String(node.data?.sublabel ?? ""));

  useEffect(() => {
    setLabel(String(node.data?.label ?? ""));
    setSublabel(String(node.data?.sublabel ?? ""));
  }, [node.id, node.data?.label, node.data?.sublabel]);

  const handleSaveName = () => {
    onUpdate?.(node.id, { label, sublabel });
  };

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-[420px] flex-col border-l border-zinc-700 bg-zinc-900/95 shadow-2xl backdrop-blur">
      <div className="flex flex-col gap-2 border-b border-zinc-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">資料庫名稱</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
            className="flex-1"
            placeholder="SQL Server"
          />
          <Input
            value={sublabel}
            onChange={(e) => setSublabel(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
            className="w-28"
            placeholder="Azure DB"
          />
        </div>
      </div>

      <div className="flex border-b border-zinc-700">
        <button
          onClick={() => setActiveTab("tables")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "tables"
              ? "border-b-2 border-cyan-500 text-cyan-400"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          資料表
        </button>
        <button
          onClick={() => setActiveTab("sps")}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "sps"
              ? "border-b-2 border-cyan-500 text-cyan-400"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          預存程序
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <MetadataEditor
          nodeId={node.id}
          activeTab={activeTab}
        />
      </div>
    </div>
  );
}
