"use client";

import { useRef, useEffect, useState } from "react";
import { Plus, LayoutGrid, Database, BarChart3, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
export type NodeTypeToAdd = "app" | "database" | "analytics";

export type DatabasePurpose = "backup" | "application";

type AddNodeDropdownProps = {
  onAddNode: (type: NodeTypeToAdd, options?: { purpose?: DatabasePurpose }) => void;
};

const NODE_OPTIONS: {
  type: NodeTypeToAdd;
  label: string;
  icon: React.ReactNode;
  purpose?: DatabasePurpose;
}[] = [
  { type: "app", label: "應用程式", icon: <LayoutGrid className="h-4 w-4" /> },
  { type: "database", label: "SQL Server (備援)", icon: <Database className="h-4 w-4" />, purpose: "backup" },
  { type: "database", label: "SQL Server (應用)", icon: <Database className="h-4 w-4" />, purpose: "application" },
  { type: "analytics", label: "分析工具", icon: <BarChart3 className="h-4 w-4" /> },
];

export function AddNodeDropdown({ onAddNode }: AddNodeDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 border-zinc-600/80 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700/95 hover:border-zinc-500 transition-colors duration-200"
        onClick={() => setOpen((o) => !o)}
      >
        <Plus className="h-4 w-4 text-cyan-400" />
        新增物件
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[180px] rounded-xl border border-zinc-700/80 bg-zinc-900/98 py-1 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden backdrop-blur-sm">
          {NODE_OPTIONS.map(({ type, label, icon, purpose }, i) => (
            <button
              key={`${type}-${purpose ?? i}`}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => {
                onAddNode(type, type === "database" && purpose ? { purpose } : undefined);
                setOpen(false);
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
