import { NextResponse } from "next/server";
import { getCanvasSetting, saveCanvasSetting } from "@/lib/db-sqlite";

const FIREWALL_KEY = "firewall_config";

export type FirewallItem = { id: string; position: number; label?: string };
export type FirewallConfig = { firewalls: FirewallItem[]; zoneLabels: string[] };

const DEFAULT_CONFIG: FirewallConfig = {
  firewalls: [
    { id: "fw1", position: 33, label: "Firewall 1" },
    { id: "fw2", position: 66, label: "Firewall 2" },
  ],
  zoneLabels: ["正式機 (Production)", "備援機 (Backup)", "內部去個資機 (De-identified)"],
};

function parseConfig(value: string | null, legacyPositions: string | null): FirewallConfig {
  if (value) {
    try {
      const parsed = JSON.parse(value) as FirewallConfig;
      if (!parsed?.firewalls || !Array.isArray(parsed.firewalls) || parsed.firewalls.length < 1) {
        return DEFAULT_CONFIG;
      }
      const firewalls = parsed.firewalls
        .filter((f) => f?.id && typeof f.position === "number")
        .map((f) => ({
          id: String(f.id),
          position: Math.max(1, Math.min(99, Math.round(f.position))),
          label: f.label || `Firewall`,
        }))
        .sort((a, b) => a.position - b.position);
      const zoneLabels = Array.isArray(parsed.zoneLabels)
        ? parsed.zoneLabels
        : DEFAULT_CONFIG.zoneLabels;
      return {
        firewalls: firewalls.length >= 1 ? firewalls : DEFAULT_CONFIG.firewalls,
        zoneLabels: zoneLabels.length >= firewalls.length + 1 ? zoneLabels : DEFAULT_CONFIG.zoneLabels,
      };
    } catch {
      // fall through to legacy check
    }
  }
  if (legacyPositions) {
    try {
      const arr = JSON.parse(legacyPositions);
      if (Array.isArray(arr) && arr.length >= 1) {
        const nums = arr.map(Number).filter((n) => !Number.isNaN(n) && n >= 1 && n <= 99);
        if (nums.length >= 1) {
          const sorted = [...nums].sort((a, b) => a - b);
          return {
            firewalls: sorted.map((p, i) => ({ id: `fw${i + 1}`, position: p, label: `Firewall ${i + 1}` })),
            zoneLabels: DEFAULT_CONFIG.zoneLabels.slice(0, sorted.length + 1),
          };
        }
      }
    } catch {
      // ignore
    }
  }
  return DEFAULT_CONFIG;
}

export async function GET() {
  try {
    const value = getCanvasSetting(FIREWALL_KEY);
    const legacyPositions = getCanvasSetting("firewall_positions");
    const config = parseConfig(value, legacyPositions);
    return NextResponse.json(config);
  } catch (error) {
    console.error("GET /api/canvas/firewall error:", error);
    return NextResponse.json(
      { error: "Failed to load firewall settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firewalls, zoneLabels } = body;
    if (!Array.isArray(firewalls) || firewalls.length < 1 || firewalls.length > 7) {
      return NextResponse.json(
        { error: "firewalls must be an array of 1–7 items" },
        { status: 400 }
      );
    }
    const items: FirewallItem[] = firewalls
      .filter((f: unknown) => f && typeof f === "object" && "id" in f && "position" in f)
      .map((f: { id: string; position: number; label?: string }) => ({
        id: String(f.id),
        position: Math.max(1, Math.min(99, Math.round(Number(f.position) || 33))),
        label: f.label || "Firewall",
      }))
      .sort((a: FirewallItem, b: FirewallItem) => a.position - b.position);
    if (items.length < 1) {
      return NextResponse.json({ error: "At least 1 firewall required" }, { status: 400 });
    }
    const labels = Array.isArray(zoneLabels)
      ? zoneLabels
      : DEFAULT_CONFIG.zoneLabels.slice(0, items.length + 1);
    const config: FirewallConfig = { firewalls: items, zoneLabels: labels };
    saveCanvasSetting(FIREWALL_KEY, JSON.stringify(config));
    return NextResponse.json({ success: true, ...config });
  } catch (error) {
    console.error("POST /api/canvas/firewall error:", error);
    return NextResponse.json(
      { error: "Failed to save firewall settings" },
      { status: 500 }
    );
  }
}
