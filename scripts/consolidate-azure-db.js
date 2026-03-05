#!/usr/bin/env node
/**
 * Azure DB 資料整併腳本
 * 將 Results.xlsx 中的分散資料整併成結構化、易讀的格式
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const INPUT_FILE = process.argv[2] || path.join(process.env.HOME || '', 'Desktop/Results.xlsx');
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

function consolidate(data) {
  const headers = data[0];
  const rows = data.slice(1);

  const tables = new Map();      // Schema.ObjectName -> table info
  const procs = new Map();      // Schema.ObjectName -> proc info
  const constraints = [];
  const indexes = [];
  const fks = [];
  const columnsByTable = new Map();  // Schema.ObjectName -> [columns]
  const paramsByProc = new Map();    // Schema.ObjectName -> [params]

  for (const row of rows) {
    const [db, capturedAt, assetType, assetSubType, schema, objectName, parentObject, ...details] = row;
    const key = `${schema}.${objectName}`;

    switch (assetType) {
      case 'TABLE':
        if (assetSubType === 'OVERVIEW') {
          tables.set(key, {
            DatabaseName: db,
            SchemaName: schema,
            ObjectName: objectName,
            RowCount: details[0] || '',
            SizeMB: details[1] || '',
            DataSizeMB: details[2] || '',
            CreatedAt: details[3] || '',
            ModifiedAt: details[4] || '',
            ColumnCount: 0,
          });
        } else if (assetSubType === 'COLUMN') {
          const cols = columnsByTable.get(key) || [];
          cols.push({
            Ordinal: details[0],
            ColumnName: details[1],
            DataType: details[2],
            MaxLength: details[3],
            IsNullable: details[4],
            IsIdentity: details[5],
            Default: details[6],
          });
          columnsByTable.set(key, cols);
        }
        break;

      case 'PROC':
        if (assetSubType === 'OVERVIEW') {
          procs.set(key, {
            DatabaseName: db,
            SchemaName: schema,
            ObjectName: objectName,
            CreatedAt: details[0] || '',
            ModifiedAt: details[1] || '',
            ParamCount: 0,
          });
        } else if (assetSubType === 'PARAM') {
          const params = paramsByProc.get(key) || [];
          params.push({
            Ordinal: details[0],
            ParamName: details[1],
            Direction: details[2],
            DataType: details[3],
          });
          paramsByProc.set(key, params);
        } else if (assetSubType === 'CODE') {
          const proc = procs.get(key);
          if (proc) proc.Definition = details[0] || row[15];
        }
        break;

      case 'CONSTRAINT':
        constraints.push({
          DatabaseName: db,
          SchemaName: schema,
          ConstraintName: objectName,
          ConstraintType: assetSubType,
          ParentObject: parentObject,
          Column: details[0] || '',
          Definition: details[7] || row[15] || '',
        });
        break;

      case 'INDEX':
        indexes.push({
          DatabaseName: db,
          SchemaName: schema,
          IndexName: objectName,
          IndexType: assetSubType,
          ParentObject: parentObject,
          Column: details[0] || '',
        });
        break;

      case 'FK':
        fks.push({
          DatabaseName: db,
          SchemaName: schema,
          FKName: objectName,
          ParentObject: parentObject,
          ReferencedTable: details[0] || '',
          Column: details[1] || '',
        });
        break;
    }
  }

  // 更新 column/param count
  columnsByTable.forEach((cols, key) => {
    const t = tables.get(key);
    if (t) t.ColumnCount = cols.length;
  });
  paramsByProc.forEach((params, key) => {
    const p = procs.get(key);
    if (p) p.ParamCount = params.length;
  });

  return {
    tables: Array.from(tables.values()),
    procs: Array.from(procs.values()),
    constraints,
    indexes,
    fks,
    columnsByTable,
    paramsByProc,
  };
}

function createSheets(consolidated) {
  const wb = XLSX.utils.book_new();

  // 1. 總覽摘要
  const summary = [
    ['Azure DB 整併摘要', ''],
    ['', ''],
    ['資料類型', '數量'],
    ['資料表 (TABLE)', consolidated.tables.length],
    ['預存程序 (PROC)', consolidated.procs.length],
    ['條件約束 (CONSTRAINT)', consolidated.constraints.length],
    ['索引 (INDEX)', consolidated.indexes.length],
    ['外鍵 (FK)', consolidated.fks.length],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), '總覽');

  // 2. 資料表清單
  const tableHeaders = ['DatabaseName', 'SchemaName', 'ObjectName', 'RowCount', 'SizeMB', 'DataSizeMB', 'CreatedAt', 'ModifiedAt', 'ColumnCount'];
  const tableData = consolidated.tables.map(t => tableHeaders.map(h => t[h] || ''));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([tableHeaders, ...tableData]), '資料表');

  // 3. 預存程序清單
  const procHeaders = ['DatabaseName', 'SchemaName', 'ObjectName', 'CreatedAt', 'ModifiedAt', 'ParamCount'];
  const procData = consolidated.procs.map(p => procHeaders.map(h => p[h] || ''));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([procHeaders, ...procData]), '預存程序');

  // 4. 條件約束
  const constraintHeaders = ['DatabaseName', 'SchemaName', 'ConstraintName', 'ConstraintType', 'ParentObject', 'Column', 'Definition'];
  const constraintData = consolidated.constraints.map(c => constraintHeaders.map(h => c[h] || ''));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([constraintHeaders, ...constraintData]), '條件約束');

  // 5. 索引
  const indexHeaders = ['DatabaseName', 'SchemaName', 'IndexName', 'IndexType', 'ParentObject', 'Column'];
  const indexData = consolidated.indexes.map(i => indexHeaders.map(h => i[h] || ''));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([indexHeaders, ...indexData]), '索引');

  // 6. 外鍵
  const fkHeaders = ['DatabaseName', 'SchemaName', 'FKName', 'ParentObject', 'ReferencedTable', 'Column'];
  const fkData = consolidated.fks.map(f => fkHeaders.map(h => f[h] || ''));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([fkHeaders, ...fkData]), '外鍵');

  // 7. 資料表欄位明細 (扁平化)
  const columnRows = [['DatabaseName', 'SchemaName', 'TableName', 'Ordinal', 'ColumnName', 'DataType', 'MaxLength', 'IsNullable', 'IsIdentity']];
  consolidated.columnsByTable.forEach((cols, key) => {
    const [schema, tableName] = key.split('.');
    const db = consolidated.tables.find(t => t.SchemaName === schema && t.ObjectName === tableName)?.DatabaseName || '';
    cols.forEach(col => {
      columnRows.push([db, schema, tableName, col.Ordinal, col.ColumnName, col.DataType, col.MaxLength, col.IsNullable, col.IsIdentity]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(columnRows), '欄位明細');

  return wb;
}

function toJsonForApp(consolidated) {
  const tables = consolidated.tables.map((t, i) => {
    const key = `${t.SchemaName}.${t.ObjectName}`;
    const cols = consolidated.columnsByTable.get(key) || [];
    return {
      id: `t-${i + 1}`,
      name: t.ObjectName,
      schemaName: t.SchemaName,
      rowCount: String(t.RowCount || ''),
      sizeMB: String(t.SizeMB || ''),
      columns: cols.map((c, j) => ({
        id: `c-${i}-${j}`,
        name: c.ColumnName || '',
        dataType: c.DataType || 'varchar',
        isNullable: c.IsNullable === '1' || c.IsNullable === 1,
      })),
    };
  });
  const procs = consolidated.procs.map((p, i) => ({
    id: `sp-${i + 1}`,
    name: p.ObjectName,
    schemaName: p.SchemaName,
    paramCount: p.ParamCount,
    definition: p.Definition || '',
  }));
  return { tables, procs, constraints: consolidated.constraints, indexes: consolidated.indexes, fks: consolidated.fks };
}

function main() {
  console.log('讀取:', INPUT_FILE);
  const data = loadData(INPUT_FILE);
  console.log('原始資料列數:', data.length - 1);

  console.log('整併中...');
  const consolidated = consolidate(data);

  console.log('建立輸出檔案...');
  const workbook = createSheets(consolidated);
  XLSX.writeFile(workbook, OUTPUT_FILE);

  console.log('完成! 輸出:', OUTPUT_FILE);

  const jsonPath = path.join(process.cwd(), 'public', 'data', 'consolidated.json');
  const jsonDir = path.dirname(jsonPath);
  if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(toJsonForApp(consolidated), null, 2), 'utf8');
  console.log('  JSON 已輸出:', jsonPath);

  console.log('\n整併結果:');
  console.log('  - 資料表:', consolidated.tables.length);
  console.log('  - 預存程序:', consolidated.procs.length);
  console.log('  - 條件約束:', consolidated.constraints.length);
  console.log('  - 索引:', consolidated.indexes.length);
  console.log('  - 外鍵:', consolidated.fks.length);
}

main();
