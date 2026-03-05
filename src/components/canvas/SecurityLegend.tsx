"use client";

import { useState } from "react";
import { Shield, Lock, ChevronDown, ChevronUp } from "lucide-react";

export function SecurityLegend() {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <div className="absolute bottom-4 left-4 right-4 z-10 max-w-xs rounded-xl border border-zinc-700/80 bg-zinc-900/95 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-md overflow-hidden sm:left-auto sm:right-4">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-zinc-800/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-cyan-400" />
          <span className="text-[0.9375rem] font-medium text-zinc-200">個資／資安防護圖例</span>
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronUp className="h-4 w-4 text-zinc-500" />}
      </button>
      {!collapsed && (
        <div className="space-y-2.5 px-4 pb-3.5 pt-2 text-[0.8125rem] border-t border-zinc-700/60">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 shrink-0 rounded-full bg-red-500 animate-pulse" />
            <span className="text-zinc-500">紅框：備援路徑有 Masking 有問題；應用路徑無 Masking 有問題</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="text-zinc-500">✓ 連線已設定 Masking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-px w-4 shrink-0 border-t-2 border-dashed border-zinc-500" />
            <span className="text-zinc-500">虛線：Firewall 環境區隔</span>
          </div>
        </div>
      )}
    </div>
  );
}
