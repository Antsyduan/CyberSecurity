"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { useCallback, useState } from "react";
import { ShieldCheck, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type JobEdgeData = {
  label?: string;
  connectionType?: "job" | "storedProcedure";
  hasMasking?: boolean;
  hasAlert?: boolean;
  alertReason?: "backupPath" | "needMasking"; // backupPath: 備援路徑不應設 Masking；needMasking: 需設定 Masking
  onUpdateMasking?: (value: boolean) => void;
  onUpdateConnectionType?: (type: "job" | "storedProcedure") => void;
};

type JobEdgeType = Edge<JobEdgeData>;

export function JobEdge(props: EdgeProps<JobEdgeType>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [showDetail, setShowDetail] = useState(false);

  const onEdgeClick = useCallback(() => {
    setShowDetail((prev) => !prev);
  }, []);

  const hasAlert = data?.hasAlert ?? false;
  const alertReason = data?.alertReason;
  const isSP = data?.connectionType === "storedProcedure";
  const edgeLabel = isSP ? "Store procedure" : "Job";

  const alertMessage =
    alertReason === "backupPath"
      ? "備援路徑，不應設定 Masking（否則備援不完整）"
      : alertReason === "needMasking"
        ? "PII 流向未設 Masking，路徑上需設定 Masking"
        : null;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={cn(
          "stroke-[2.5] transition-colors duration-200",
          hasAlert
            ? "stroke-red-500/90 animate-pulse"
            : "stroke-zinc-500/80 hover:stroke-cyan-500/60"
        )}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
                <button
                  onClick={onEdgeClick}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[0.8125rem] font-medium transition-all duration-200",
                    "border-zinc-600/80 bg-zinc-800/95 text-zinc-200 shadow-sm hover:bg-zinc-700/95 hover:border-zinc-500",
                    hasAlert && "border-red-500/70 bg-red-900/40 text-red-200"
                  )}
                >
                  {edgeLabel}
                </button>
                <span
                  className={cn(
                    "flex items-center rounded px-1.5 py-0.5",
                    data?.hasMasking
                      ? "bg-emerald-900/60 text-emerald-400"
                      : hasAlert
                        ? "bg-red-900/60 text-red-400"
                        : "bg-zinc-700/80 text-zinc-500"
                  )}
                  title={data?.hasMasking ? "已設定 Masking" : "未設定 Masking"}
                >
                {data?.hasMasking ? (
                  <ShieldCheck className="h-3 w-3" />
                ) : (
                  <Shield className="h-3 w-3" />
                  )}
                </span>
            </div>
            {hasAlert && alertMessage && (
              <div className="max-w-[140px] text-[10px] text-red-400 leading-tight text-center break-words">
                {alertMessage}
              </div>
            )}
          </div>
          {showDetail && (
            <div className="absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 rounded-lg border border-zinc-600 bg-zinc-900 p-3 shadow-xl min-w-[180px]">
              <div className="text-xs text-zinc-400 mb-2">類型</div>
              {data?.onUpdateConnectionType ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onUpdateConnectionType?.("job");
                    }}
                    className={cn(
                      "flex-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors",
                      !isSP
                        ? "border-cyan-500 bg-cyan-900/40 text-cyan-300"
                        : "border-zinc-600 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    )}
                  >
                    Job
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onUpdateConnectionType?.("storedProcedure");
                    }}
                    className={cn(
                      "flex-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors",
                      isSP
                        ? "border-cyan-500 bg-cyan-900/40 text-cyan-300"
                        : "border-zinc-600 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    )}
                  >
                    SP
                  </button>
                </div>
              ) : (
                <div className="text-xs text-zinc-300">
                  {isSP ? "Store procedure" : "Job"}
                </div>
              )}
              <div className="mt-2 text-xs text-zinc-400">
                {data?.hasMasking ? "✓ 含去個資" : "未設定 Masking"}
              </div>
              {!isSP && data?.onUpdateMasking && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full border-cyan-600/60 text-cyan-400 hover:bg-cyan-600/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onUpdateMasking?.(!data.hasMasking);
                  }}
                >
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  {data.hasMasking ? "取消 Masking" : "設定 Masking"}
                </Button>
              )}
              <div className="mt-2 text-[10px] text-zinc-500">
                點擊連線查看同步邏輯
              </div>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
