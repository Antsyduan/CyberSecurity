#!/usr/bin/env node
/**
 * Azure DB 資料整併腳本 (v2 - 支援 TABLE_OR_VIEW / PROC 格式)
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const INPUT_FILE = process.argv[2] || path.join(process.env.HOME || '', 'Downloads/Results.xlsx');
const OUTPUT_FILE = process.argv[3] || path.join(path.dirname(INPUT_FILE), 'Results_Consolidated.xlsx');

function loadData(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error('找不到檔案:', filePath);
    process.exit(1);
  }
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['sheet1'] || workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

function consolidateV2(data) {
  const rows = data.slice(1);
  const tables = new Map();
  const views = new Map();
  const procs = new Map();

  for (const row of rows) {
    const db = row[0], assetType = row[2], assetSubType = row[3], schema = row[4], objectName = row[5], itemName = row[6], itemOrdinal = row[7], dataType = row[8], typeDetail = row[9], isNullable = row[10], isIdentity = row[11], description = row[17], procDirection = row[18];
    const key = `${schema}.${objectName}`;

    if (assetType === 'TABLE_OR_VIEW' && assetSubType === 'USER_TABLE') {
      const cols = tables.get(key)?.columns || [];
      if (!tables.has(key)) {
        tables.set(key, {
          DatabaseName: db,
          SchemaName: schema,
          ObjectName: objectName,
          columns: [],
        });
      }
      tables.get(key).columns.push({
        Ordinal: itemOrdinal,
        ColumnName: itemName,
        DataType: typeDetail ? `${dataType}(${typeDetail})` : dataType,
        IsNullable: isNullable,
        IsIdentity: isIdentity,
        Description: description || '',
      });
    } else if (assetType === 'TABLE_OR_VIEW' && assetSubType === 'VIEW') {
      const cols = views.get(key)?.columns || [];
      if (!views.has(key)) {
        views.set(key, {
          DatabaseName: db,
          SchemaName: schema,
          ObjectName: objectName,
          columns: [],
        });
      }
      views.get(key).columns.push({
        Ordinal: itemOrdinal,
        ColumnName: itemName,
        DataType: typeDetail ? `${dataType}(${typeDetail})` : dataType,
        IsNullable: isNullable,
        IsIdentity: isIdentity,
        Description: description || '',
      });
    } else if (assetType === 'PROC' && assetSubType === 'STORED_PROCEDURE_PARAM') {
      const params = procs.get(key)?.params || [];
      if (!procs.has(key)) {
        procs.set(key, {
          DatabaseName: db,
          SchemaName: schema,
          ObjectName: objectName,
          params: [],
        });
      }
      procs.get(key).params.push({
        Ordinal: itemOrdinal,
        ParamName: itemName,
        DataType: dataType,
        Direction: procDirection || 'INPUT',
      });
    }
  }

  const tableList = Array.from(tables.values()).map((t, i) => ({
    ...t,
    id: `t-${i + 1}`,
    rowCount: '',
    sizeMB: '',
  }));

  const viewList = Array.from(views.values()).map((v, i) => ({
    ...v,
    id: `v-${i + 1}`,
    rowCount: '',
    sizeMB: '',
  }));

  const procList = Array.from(procs.values()).map((p, i) => ({
    ...p,
    id: `sp-${i + 1}`,
    paramCount: p.params?.length ?? 0,
  }));

  return {
    tables: tableList,
    views: viewList,
    procs: procList,
    constraints: [],
    indexes: [],
    fks: [],
    columnsByTable: new Map(Array.from(tables.entries()).map(([k, v]) => [k, v.columns])),
  };
}

function toJsonForApp(consolidated) {
  const tables = consolidated.tables.map((t) => ({
    id: t.id,
    name: t.ObjectName,
    schemaName: t.SchemaName,
    rowCount: t.rowCount || '',
    sizeMB: t.sizeMB || '',
    columns: (t.columns || []).map((c, j) => ({
      id: `c-${t.id}-${j}`,
      name: c.ColumnName || '',
      dataType: c.DataType || 'varchar',
      isNullable: !!c.IsNullable,
      description: c.Description || '',
    })),
  }));
  const views = (consolidated.views || []).map((v) => ({
    id: v.id,
    name: v.ObjectName,
    schemaName: v.SchemaName,
    rowCount: v.rowCount || '',
    sizeMB: v.sizeMB || '',
    columns: (v.columns || []).map((c, j) => ({
      id: `c-${v.id}-${j}`,
      name: c.ColumnName || '',
      dataType: c.DataType || 'varchar',
      isNullable: !!c.IsNullable,
      description: c.Description || '',
    })),
  }));
  const procs = consolidated.procs.map((p) => ({
    id: p.id,
    name: p.ObjectName,
    schemaName: p.SchemaName,
    paramCount: p.paramCount,
    definition: '',
    params: (p.params || []).map((pa) => ({
      name: pa.ParamName,
      dataType: pa.DataType,
      direction: pa.Direction,
    })),
  }));
  return { tables, views, procs, constraints: [], indexes: [], fks: [] };
}

function createSheets(consolidated) {
  const wb = XLSX.utils.book_new();
  const summary = [
    ['Azure DB 整併摘要', ''],
    ['資料表', consolidated.tables.length],
    ['View', (consolidated.views || []).length],
    ['預存程序', consolidated.procs.length],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), '總覽');

  const tableRows = [['Schema', 'Table', 'ColumnCount']];
  consolidated.tables.forEach((t) => {
    tableRows.push([t.SchemaName, t.ObjectName, (t.columns || []).length]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tableRows), '資料表');

  const viewRows = [['Schema', 'View', 'ColumnCount']];
  (consolidated.views || []).forEach((v) => {
    viewRows.push([v.SchemaName, v.ObjectName, (v.columns || []).length]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(viewRows), 'View');

  const procRows = [['Schema', 'Procedure', 'ParamCount']];
  consolidated.procs.forEach((p) => {
    procRows.push([p.SchemaName, p.ObjectName, (p.params || []).length]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(procRows), '預存程序');

  return wb;
}

function main() {
  console.log('讀取:', INPUT_FILE);
  const data = loadData(INPUT_FILE);
  console.log('原始資料列數:', data.length - 1);

  const consolidated = consolidateV2(data);

  const workbook = createSheets(consolidated);
  XLSX.writeFile(workbook, OUTPUT_FILE);
  console.log('Excel 輸出:', OUTPUT_FILE);

  const appData = toJsonForApp(consolidated);

  const dbDir = path.join(process.cwd(), 'data');
  const dbPath = path.join(dbDir, 'canvas.db');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS consolidated_node_data (
      node_id TEXT PRIMARY KEY,
      tables_json TEXT NOT NULL DEFAULT '[]',
      views_json TEXT NOT NULL DEFAULT '[]',
      procs_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  try {
    db.exec(`ALTER TABLE consolidated_node_data ADD COLUMN views_json TEXT NOT NULL DEFAULT '[]'`);
  } catch (_) {}
  db.prepare(`
    INSERT INTO consolidated_node_data (node_id, tables_json, views_json, procs_json, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(node_id) DO UPDATE SET
      tables_json = excluded.tables_json,
      views_json = COALESCE(excluded.views_json, '[]'),
      procs_json = excluded.procs_json,
      updated_at = datetime('now')
  `).run('azure_db', JSON.stringify(appData.tables), JSON.stringify(appData.views || []), JSON.stringify(appData.procs));
  db.close();
  console.log('SQLite 已寫入:', dbPath, '(node_id: azure_db)');

  console.log('  - 資料表:', consolidated.tables.length);
  console.log('  - View:', (consolidated.views || []).length);
  console.log('  - 預存程序:', consolidated.procs.length);
}

main();
