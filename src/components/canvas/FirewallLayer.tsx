"use client";

import type { FirewallConfig } from "./FirewallSettings";

type FirewallLayerProps = {
  config?: FirewallConfig | null;
};

const DEFAULT_POSITIONS = [33, 66];
const DEFAULT_ZONES = ["正式機 (Production)", "備援機 (Backup)", "內部去個資機 (De-identified)"];

export function FirewallLayer({ config }: FirewallLayerProps) {
  const positions = config?.firewalls?.map((f) => f.position).sort((a, b) => a - b) ?? DEFAULT_POSITIONS;
  const zoneLabels = config?.zoneLabels ?? DEFAULT_ZONES;
  const lines = positions.map((p, i) => ({ x: `${p}%`, label: config?.firewalls?.[i]?.label ?? "Firewall" }));
  const zonePositions: { x: string; label: string }[] = [];
  for (let i = 0; i <= positions.length; i++) {
    const left = i === 0 ? 0 : positions[i - 1];
    const right = i === positions.length ? 100 : positions[i];
    zonePositions.push({
      x: `${(left + right) / 2}%`,
      label: zoneLabels[i] ?? `Zone ${i + 1}`,
    });
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {/* 垂直虛線 - Firewall */}
      {lines.map((line, i) => (
        <div
          key={i}
          className="absolute top-0 h-full w-px border-l border-dashed border-zinc-600/60"
          style={{ left: line.x }}
        >
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-zinc-500/90 tracking-wide">
            {line.label}
          </div>
        </div>
      ))}

      {/* 區域標籤 */}
      {zonePositions.map((zone, i) => (
        <div
          key={i}
          className="absolute top-4 text-center text-sm font-medium text-zinc-500/80 tracking-wide"
          style={{ left: zone.x, transform: "translateX(-50%)" }}
        >
          {zone.label}
        </div>
      ))}
    </div>
  );
}
