#!/usr/bin/env node
/**
 * 診斷 Excel 欄位結構：列出 assetType、assetSubType 等實際值
 * 用法: node scripts/inspect-excel-columns.js <Results.xlsx 路徑>
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const INPUT_FILE = process.argv[2] || path.join(process.env.HOME || '', 'Downloads/Results.xlsx');

function loadData(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error('找不到檔案:', filePath);
    process.exit(1);
  }
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['sheet1'] || workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

function main() {
  console.log('讀取:', INPUT_FILE);
  const data = loadData(INPUT_FILE);
  const header = data[0] || [];
  const rows = data.slice(1);

  console.log('\n=== 表頭（第 1 列）===');
  header.forEach((h, i) => console.log(`  [${i}] ${h}`));

  const assetTypeSet = new Set();
  const assetSubTypeSet = new Set();
  const comboSet = new Set();
  const viewLike = [];

  for (const row of rows) {
    const assetType = row[2];
    const assetSubType = row[3];
    if (assetType != null && String(assetType).trim()) assetTypeSet.add(String(assetType).trim());
    if (assetSubType != null && String(assetSubType).trim()) assetSubTypeSet.add(String(assetSubType).trim());
    if (assetType != null || assetSubType != null) {
      comboSet.add(`${assetType} | ${assetSubType}`);
    }
    if (assetSubType && /view/i.test(String(assetSubType))) {
      viewLike.push({ assetType, assetSubType, schema: row[4], objectName: row[5] });
    }
  }

  console.log('\n=== assetType（第 3 欄 index=2）實際值 ===');
  [...assetTypeSet].sort().forEach((v) => console.log('  ', v));

  console.log('\n=== assetSubType（第 4 欄 index=3）實際值 ===');
  [...assetSubTypeSet].sort().forEach((v) => console.log('  ', v));

  console.log('\n=== assetType | assetSubType 組合（前 30 種）===');
  [...comboSet].sort().slice(0, 30).forEach((v) => console.log('  ', v));

  if (viewLike.length > 0) {
    console.log('\n=== 含 "view" 的 assetSubType 列（前 5 筆）===');
    viewLike.slice(0, 5).forEach((v) => console.log('  ', v));
    console.log('  共', viewLike.length, '筆');
  } else {
    console.log('\n=== 無 assetSubType 含 "view" 的列 ===');
    console.log('  若您的 View 使用不同命名，請依上表調整整併腳本');
  }

  console.log('\n腳本預期: assetType="TABLE_OR_VIEW", assetSubType="VIEW" 才會被當成 View');
}

main();
