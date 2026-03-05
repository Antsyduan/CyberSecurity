import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "canvas.db");

let db: Database.Database | null = null;

function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (!db) {
    ensureDbDir();
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS flow_canvas (
        id INTEGER PRIMARY KEY DEFAULT 1,
        nodes_json TEXT NOT NULL DEFAULT '[]',
        edges_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO flow_canvas (id, nodes_json, edges_json) VALUES (1, '[]', '[]');

      CREATE TABLE IF NOT EXISTS consolidated_node_data (
        node_id TEXT PRIMARY KEY,
        tables_json TEXT NOT NULL DEFAULT '[]',
        procs_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS canvas_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT OR IGNORE INTO canvas_settings (key, value) VALUES ('firewall_config', '{"firewalls":[{"id":"fw1","position":33,"label":"Firewall 1"},{"id":"fw2","position":66,"label":"Firewall 2"}],"zoneLabels":["正式機 (Production)","備援機 (Backup)","內部去個資機 (De-identified)"]}');
    `);
    try {
      db.exec("ALTER TABLE consolidated_node_data ADD COLUMN views_json TEXT NOT NULL DEFAULT '[]'");
    } catch {
      // column may already exist
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS migration_config (
        source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        config_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (source_node_id, target_node_id)
      );
    `);
  }
  return db;
}

export type MigrationConfig = {
  tableIds: string[];
  viewIds: string[];
  procIds: string[];
  columnsByTable: Record<string, string[]>; // tableId -> columnIds
  columnsByView: Record<string, string[]>;  // viewId -> columnIds
};

export function getMigrationConfig(
  sourceNodeId: string,
  targetNodeId: string
): MigrationConfig | null {
  const database = getDb();
  const row = database
    .prepare(
      "SELECT config_json FROM migration_config WHERE source_node_id = ? AND target_node_id = ?"
    )
    .get(sourceNodeId, targetNodeId) as { config_json: string } | undefined;
  if (!row?.config_json) return null;
  try {
    return JSON.parse(row.config_json) as MigrationConfig;
  } catch {
    return null;
  }
}

export function saveMigrationConfig(
  sourceNodeId: string,
  targetNodeId: string,
  config: MigrationConfig
): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO migration_config (source_node_id, target_node_id, config_json, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(source_node_id, target_node_id) DO UPDATE SET
         config_json = excluded.config_json,
         updated_at = datetime('now')`
    )
    .run(sourceNodeId, targetNodeId, JSON.stringify(config));
}

export function getCanvasState(): { nodes: string; edges: string } {
  const database = getDb();
  const row = database
    .prepare("SELECT nodes_json, edges_json FROM flow_canvas WHERE id = 1")
    .get() as { nodes_json: string; edges_json: string } | undefined;
  if (!row) {
    return { nodes: "[]", edges: "[]" };
  }
  return {
    nodes: row.nodes_json || "[]",
    edges: row.edges_json || "[]",
  };
}

export function saveCanvasState(nodes: string, edges: string): void {
  const database = getDb();
  database
    .prepare(
      "UPDATE flow_canvas SET nodes_json = ?, edges_json = ?, updated_at = datetime('now') WHERE id = 1"
    )
    .run(nodes, edges);
}

export function getConsolidatedData(nodeId: string): {
  tables: string;
  views: string;
  procs: string;
} | null {
  const database = getDb();
  let row: { tables_json: string; procs_json: string; views_json?: string } | undefined;
  try {
    row = database
      .prepare(
        "SELECT tables_json, views_json, procs_json FROM consolidated_node_data WHERE node_id = ?"
      )
      .get(nodeId) as { tables_json: string; procs_json: string; views_json?: string } | undefined;
  } catch {
    row = database
      .prepare(
        "SELECT tables_json, procs_json FROM consolidated_node_data WHERE node_id = ?"
      )
      .get(nodeId) as { tables_json: string; procs_json: string } | undefined;
  }
  if (!row) return null;
  return {
    tables: row.tables_json || "[]",
    views: row.views_json || "[]",
    procs: row.procs_json || "[]",
  };
}

export function getCanvasSetting(key: string): string | null {
  const database = getDb();
  const row = database
    .prepare("SELECT value FROM canvas_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function saveCanvasSetting(key: string, value: string): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO canvas_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value);
}

export function saveConsolidatedData(
  nodeId: string,
  tables: string,
  procs: string,
  views?: string
): void {
  const database = getDb();
  const viewsJson = views ?? "[]";
  try {
    database
      .prepare(
        `INSERT INTO consolidated_node_data (node_id, tables_json, views_json, procs_json, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(node_id) DO UPDATE SET
           tables_json = excluded.tables_json,
           views_json = excluded.views_json,
           procs_json = excluded.procs_json,
           updated_at = datetime('now')`
      )
      .run(nodeId, tables, viewsJson, procs);
  } catch {
    database
      .prepare(
        `INSERT INTO consolidated_node_data (node_id, tables_json, procs_json, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(node_id) DO UPDATE SET
           tables_json = excluded.tables_json,
           procs_json = excluded.procs_json,
           updated_at = datetime('now')`
      )
      .run(nodeId, tables, procs);
  }
}
