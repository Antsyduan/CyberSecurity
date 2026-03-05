"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Node } from "@xyflow/react";
import { X, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type NodeEditPanelProps = {
  node: Node;
  onUpdate: (nodeId: string, data: Partial<Node["data"]>) => void;
  onClose: () => void;
};

export function NodeEditPanel({ node, onUpdate, onClose }: NodeEditPanelProps) {
  const router = useRouter();
  const isDatabase = node.type === "database";
  const [label, setLabel] = useState(String(node.data?.label ?? ""));
  const [sublabel, setSublabel] = useState(String(node.data?.sublabel ?? ""));
  const [displayName, setDisplayName] = useState(String(node.data?.displayName ?? ""));

  useEffect(() => {
    setLabel(String(node.data?.label ?? ""));
    setSublabel(String(node.data?.sublabel ?? ""));
    setDisplayName(String(node.data?.displayName ?? ""));
  }, [node.id, node.data?.label, node.data?.sublabel, node.data?.displayName]);

  const handleSave = () => {
    if (isDatabase) {
      onUpdate(node.id, { label, sublabel, displayName: displayName.trim() || undefined });
    } else {
      onUpdate(node.id, { label });
    }
  };

  return (
    <div className="absolute right-0 top-0 z-20 flex h-auto w-full max-w-[320px] flex-col rounded-l-lg border-l border-t border-b border-zinc-700 bg-zinc-900/95 shadow-2xl backdrop-blur sm:w-[320px]">
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
        <span className="text-sm font-medium text-zinc-400">編輯物件</span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <Label className="text-zinc-400">名稱</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="mt-1"
            placeholder="輸入名稱"
          />
        </div>
        {isDatabase && (
          <>
            <div>
              <Label className="text-zinc-400">副標題 (如 Azure DB / Local DB)</Label>
              <Input
                value={sublabel}
                onChange={(e) => setSublabel(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="mt-1"
                placeholder="Azure DB / Local DB"
              />
            </div>
            <div>
              <Label className="text-zinc-400">顯示名稱 (用於移轉設定等)</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="mt-1"
                placeholder="如 Report DB、Test DB"
              />
            </div>
          </>
        )}
        <Button variant="outline" size="sm" onClick={handleSave}>
          儲存
        </Button>
        {(isDatabase || node.type === "analytics") && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => router.push(`/database/${node.id}`)}
          >
            <Database className="h-4 w-4" />
            進入維運管理
          </Button>
        )}
      </div>
    </div>
  );
}
