"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

export type AppNodeData = {
  label: string;
  hasAlert?: boolean;
  alertReason?: "backupPath" | "needMasking";
};

const ALERT_MESSAGES: Record<string, string> = {
  backupPath: "備援路徑，不應設定 Masking（否則備援不完整）",
  needMasking: "PII 流向未設 Masking，路徑上需設定 Masking",
};

function AppNodeComponent({ data, selected }: NodeProps<Node<AppNodeData>>) {
  const alertMessage = data.alertReason ? ALERT_MESSAGES[data.alertReason] : null;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={cn(
          "flex min-w-[120px] items-center justify-center rounded-xl border px-4 py-3 transition-all duration-200",
          "border-zinc-500/40 bg-gradient-to-b from-zinc-800/95 to-zinc-900/95 text-zinc-100",
          "shadow-[0_4px_16px_-4px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-sm",
          "hover:border-zinc-400/60 hover:shadow-[0_6px_24px_-6px_rgba(0,0,0,0.5)]",
          selected && "ring-2 ring-zinc-400/70 ring-offset-2 ring-offset-zinc-950",
          data.hasAlert && "animate-pulse border-red-500/80 shadow-red-500/25"
        )}
      >
        <Handle type="target" position={Position.Left} className="nodrag !w-3 !h-3 !min-w-[12px] !min-h-[12px] !bg-zinc-500" />
        <span className="nodrag text-[0.95rem] font-medium leading-snug">{data.label}</span>
        <Handle type="source" position={Position.Right} className="nodrag !w-3 !h-3 !min-w-[12px] !min-h-[12px] !bg-zinc-500" />
      </div>
      {data.hasAlert && alertMessage && (
        <div className="max-w-[160px] text-[10px] text-red-400 break-words text-center leading-tight">
          {alertMessage}
        </div>
      )}
    </div>
  );
}

export const AppNode = memo(AppNodeComponent);
