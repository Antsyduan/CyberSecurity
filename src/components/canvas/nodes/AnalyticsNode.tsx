"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AnalyticsNodeData = {
  label: string;
  hasAlert?: boolean;
  alertReason?: "backupPath" | "needMasking";
};

const ALERT_MESSAGES: Record<string, string> = {
  backupPath: "備援路徑，不應設定 Masking（否則備援不完整）",
  needMasking: "PII 流向未設 Masking，路徑上需設定 Masking",
};

function AnalyticsNodeComponent({ data, selected }: NodeProps<Node<AnalyticsNodeData>>) {
  const alertMessage = data.alertReason ? ALERT_MESSAGES[data.alertReason] : null;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={cn(
          "flex min-w-[100px] items-center justify-center gap-2 rounded-xl border px-4 py-3 transition-all duration-200",
          "border-emerald-500/50 bg-gradient-to-b from-zinc-800/98 to-zinc-900/98 text-zinc-100",
          "shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5),0_0_0_1px_rgba(52,211,153,0.08)] backdrop-blur-sm",
          "hover:border-emerald-400/60 hover:shadow-[0_8px_28px_-6px_rgba(0,0,0,0.5),0_0_0_1px_rgba(52,211,153,0.12)]",
          selected && "ring-2 ring-emerald-400/80 ring-offset-2 ring-offset-zinc-950 shadow-[0_0_0_1px_rgba(52,211,153,0.3)]",
          data.hasAlert && "animate-pulse border-red-500/80 shadow-red-500/25"
        )}
      >
        <Handle type="target" position={Position.Left} className="nodrag !w-3 !h-3 !min-w-[12px] !min-h-[12px] !bg-emerald-500" />
        <BarChart3 className="h-4 w-4 text-emerald-400" />
        <span className="text-[0.95rem] font-medium leading-snug">{data.label}</span>
      </div>
      {data.hasAlert && alertMessage && (
        <div className="max-w-[160px] text-[10px] text-red-400 break-words text-center leading-tight">
          {alertMessage}
        </div>
      )}
    </div>
  );
}

export const AnalyticsNode = memo(AnalyticsNodeComponent);
