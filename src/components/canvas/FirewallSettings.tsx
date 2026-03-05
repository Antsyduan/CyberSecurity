"use client";

import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Shield, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type FirewallItem = { id: string; position: number; label?: string };
export type FirewallConfig = { firewalls: FirewallItem[]; zoneLabels: string[] };

type FirewallSettingsProps = {
  config: FirewallConfig;
  onSave: (config: FirewallConfig) => void;
};

const DEFAULT_ZONE_LABELS = ["正式機 (Production)", "備援機 (Backup)", "內部去個資機 (De-identified)"];

function generateId() {
  return `fw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function FirewallSettings({ config, onSave }: FirewallSettingsProps) {
  const [open, setOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<FirewallConfig>(config);
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        open &&
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSave = () => {
    const sorted = {
      ...localConfig,
      firewalls: [...localConfig.firewalls].sort((a, b) => a.position - b.position),
    };
    onSave(sorted);
    setOpen(false);
  };

  const handleAdd = () => {
    if (localConfig.firewalls.length >= 7) return;
    const maxPos = Math.max(...localConfig.firewalls.map((f) => f.position), 0);
    const newPos = Math.min(maxPos + 15, 85);
    setLocalConfig({
      ...localConfig,
      firewalls: [
        ...localConfig.firewalls,
        { id: generateId(), position: newPos, label: `Firewall ${localConfig.firewalls.length + 1}` },
      ],
      zoneLabels: [...localConfig.zoneLabels, `Zone ${localConfig.firewalls.length + 2}`],
    });
  };

  const handleRemove = (id: string) => {
    if (localConfig.firewalls.length <= 1) return;
    const next = localConfig.firewalls.filter((f) => f.id !== id);
    const zones = localConfig.zoneLabels.slice(0, next.length + 1);
    setLocalConfig({ firewalls: next, zoneLabels: zones });
  };

  const handlePositionChange = (id: string, position: number) => {
    setLocalConfig({
      ...localConfig,
      firewalls: localConfig.firewalls.map((f) =>
        f.id === id ? { ...f, position: Math.max(1, Math.min(99, position)) } : f
      ),
    });
  };

  const handleZoneLabelChange = (index: number, label: string) => {
    const next = [...localConfig.zoneLabels];
    next[index] = label;
    setLocalConfig({ ...localConfig, zoneLabels: next });
  };

  const dropdownContent =
    open &&
    (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] min-w-72 rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-2xl"
      style={{
        top: (buttonRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
        left: buttonRef.current?.getBoundingClientRect().left ?? 0,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        資安架構：每條 Firewall 代表安全邊界，可依防禦縱深需求彈性增減
      </p>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {localConfig.firewalls.map((fw) => (
          <div
            key={fw.id}
            className="flex min-h-9 items-center gap-3 rounded border border-zinc-700/50 bg-zinc-800/50 px-3 py-2"
          >
            <span className="w-20 shrink-0 text-xs text-zinc-400">{fw.label}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={99}
                value={fw.position}
                onChange={(e) => handlePositionChange(fw.id, Number(e.target.value))}
                className="h-7 w-14 rounded border border-zinc-600 bg-zinc-800 px-2 text-sm text-zinc-200"
              />
              <span className="text-xs text-zinc-500">%</span>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(fw.id)}
              disabled={localConfig.firewalls.length <= 1}
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-red-900/30 hover:text-red-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
              title="移除 Firewall"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2 border-t border-zinc-700 pt-3">
        <p className="text-xs text-zinc-500">區域名稱（由左至右）</p>
        {localConfig.zoneLabels.slice(0, localConfig.firewalls.length + 1).map((label, i) => (
          <div key={i} className="flex min-h-8 items-center gap-3">
            <span className="w-12 shrink-0 text-xs text-zinc-500">Zone {i + 1}</span>
            <input
              type="text"
              value={label}
              onChange={(e) => handleZoneLabelChange(i, e.target.value)}
              className="min-w-0 flex-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
              placeholder={`Zone ${i + 1}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={localConfig.firewalls.length >= 7}
          className="flex h-8 items-center gap-1.5 rounded border border-zinc-600 px-3 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          新增 Firewall
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="h-8 rounded bg-cyan-600 px-3 text-xs font-medium text-white hover:bg-cyan-500"
        >
          套用
        </button>
        <button
          type="button"
          onClick={() => {
            setLocalConfig({
              firewalls: [
                { id: "fw1", position: 33, label: "Firewall 1" },
                { id: "fw2", position: 66, label: "Firewall 2" },
              ],
              zoneLabels: DEFAULT_ZONE_LABELS,
            });
          }}
          className="h-8 rounded border border-zinc-600 px-3 text-xs text-zinc-400 hover:bg-zinc-800"
        >
          還原預設
        </button>
      </div>
    </div>
    );

  return (
    <>
      <div ref={buttonRef} className="relative">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-zinc-600 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100"
          onClick={() => setOpen((o) => !o)}
        >
          <Shield className="h-4 w-4 text-amber-400" />
          Firewall 設定
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </div>
      {typeof document !== "undefined" && createPortal(dropdownContent, document.body)}
    </>
  );
}
