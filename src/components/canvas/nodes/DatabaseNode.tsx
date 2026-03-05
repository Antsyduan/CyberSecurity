"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";

export type DatabaseNodeData = {
  label: string;
  sublabel?: string; // e.g. "Azure DB" | "Local DB"
  displayName?: string; // 自訂顯示名稱（用於移轉設定等）
  /** 備援：備援目的，不應設 Masking；應用：與 Masking 有關 */
  purpose?: "backup" | "application";
  hasAlert?: boolean;
  alertReason?: "backupPath" | "needMasking";
  tableCount?: number;
  viewCount?: number;
  procCount?: number;
};

const ALERT_MESSAGES: Record<string, string> = {
  backupPath: "備援路徑，不應設定 Masking（否則備援不完整）",
  needMasking: "PII 流向未設 Masking，路徑上需設定 Masking",
};

function DatabaseNodeComponent({ data, selected }: NodeProps<Node<DatabaseNodeData>>) {
  const alertMessage = data.alertReason ? ALERT_MESSAGES[data.alertReason] : null;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={cn(
          "flex flex-col items-center gap-1 rounded-xl border px-5 py-4 transition-all duration-200",
          "border-cyan-500/50 bg-gradient-to-b from-zinc-800/98 to-zinc-900/98 text-zinc-100",
          "shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5),0_0_0_1px_rgba(34,211,238,0.08)] backdrop-blur-sm",
          "hover:border-cyan-400/60 hover:shadow-[0_8px_28px_-6px_rgba(0,0,0,0.5),0_0_0_1px_rgba(34,211,238,0.12)]",
          selected && "ring-2 ring-cyan-400/80 ring-offset-2 ring-offset-zinc-950 shadow-[0_0_0_1px_rgba(34,211,238,0.3)]",
          data.hasAlert && "animate-pulse border-red-500/80 shadow-red-500/25"
        )}
      >
        <Handle type="target" position={Position.Left} className="nodrag !w-3 !h-3 !min-w-[12px] !min-h-[12px] !bg-cyan-500" />
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-cyan-400" />
          <div className="text-center">
            <div className="text-[0.95rem] font-semibold leading-snug">{data.label}</div>
            <div className="flex items-center justify-center gap-1.5">
              {(data.displayName || data.sublabel) && (
                <span className="text-[0.8125rem] text-zinc-400">{data.displayName || data.sublabel}</span>
              )}
              {data.purpose && (
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[0.6875rem] font-medium ring-1",
                    data.purpose === "backup"
                      ? "bg-amber-500/15 text-amber-400/95 ring-amber-500/25"
                      : "bg-cyan-500/15 text-cyan-400/95 ring-cyan-500/25"
                  )}
                >
                  {data.purpose === "backup" ? "備援" : "應用"}
                </span>
              )}
            </div>
            {(data.tableCount != null || data.viewCount != null || data.procCount != null) && (
              <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[0.6875rem] font-medium">
                <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-cyan-400/95 ring-1 ring-cyan-500/20">
                  {data.tableCount ?? 0} Table
                </span>
                <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-violet-400/95 ring-1 ring-violet-500/20">
                  {data.viewCount ?? 0} View
                </span>
                <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-400/95 ring-1 ring-amber-500/20">
                  {data.procCount ?? 0} SP
                </span>
              </div>
            )}
          </div>
        </div>
        <Handle type="source" position={Position.Right} className="nodrag !w-3 !h-3 !min-w-[12px] !min-h-[12px] !bg-cyan-500" />
      </div>
      {data.hasAlert && alertMessage && (
        <div className="max-w-[160px] text-[0.6875rem] text-red-400 break-words text-center leading-tight">
          {alertMessage}
        </div>
      )}
    </div>
  );
}

export const DatabaseNode = memo(DatabaseNodeComponent);
