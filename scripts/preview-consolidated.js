#!/usr/bin/env node
/**
 * 產生整併資料的 HTML 預覽頁面
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const INPUT_FILE = process.argv[2] || path.join(process.env.HOME || '', 'Desktop/Results_Consolidated.xlsx');
const OUTPUT_HTML = process.argv[3] || path.join(path.dirname(INPUT_FILE), 'Results_Consolidated_Preview.html');

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateHtml(workbook) {
  const sheets = workbook.SheetNames.filter(n => n !== '總覽');
  const summarySheet = workbook.Sheets['總覽'];
  const summaryData = XLSX.utils.sheet_to_json(summarySheet, { header: 1, defval: '' });

  let tabsHtml = '';
  let contentHtml = '';

  sheets.forEach((name, idx) => {
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const headers = data[0] || [];
    const rows = data.slice(1);

    const activeClass = idx === 0 ? 'active' : '';
    tabsHtml += `<button class="tab" data-tab="${idx}">${escapeHtml(name)} (${rows.length})</button>`;

    let tableRows = rows.slice(0, 100).map(row => {
      const cells = headers.map((h, i) => `<td>${escapeHtml(row[i] ?? '')}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    if (rows.length > 100) {
      tableRows += `<tr><td colspan="${headers.length}" class="more">... 僅顯示前 100 筆，共 ${rows.length} 筆</td></tr>`;
    }

    contentHtml += `
      <div class="tab-content ${activeClass}" data-content="${idx}">
        <table>
          <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;
  });

  const summaryRows = summaryData
    .filter((row, i) => i >= 2 && row[0])
    .map(row => `<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Azure DB 整併資料預覽</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #1a1a2e; color: #eee; }
    h1 { color: #00d9ff; margin-bottom: 8px; }
    .subtitle { color: #888; margin-bottom: 24px; }
    .summary { background: #16213e; border-radius: 8px; padding: 20px; margin-bottom: 24px; max-width: 400px; }
    .summary table { width: 100%; }
    .summary td { padding: 8px 12px; }
    .summary td:last-child { text-align: right; color: #00d9ff; font-weight: 600; }
    .tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 16px; }
    .tab { background: #16213e; border: 1px solid #0f3460; color: #eee; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .tab:hover { background: #0f3460; }
    .tab.active { background: #00d9ff; color: #1a1a2e; border-color: #00d9ff; }
    .tab-content { display: none; overflow-x: auto; }
    .tab-content.active { display: block; }
    table { width: 100%; border-collapse: collapse; background: #16213e; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #0f3460; }
    th { background: #0f3460; color: #00d9ff; font-weight: 600; white-space: nowrap; }
    tr:hover { background: rgba(0,217,255,0.05); }
    td.more { text-align: center; color: #888; font-style: italic; }
  </style>
</head>
<body>
  <h1>Azure DB 整併資料預覽</h1>
  <p class="subtitle">Results_Consolidated.xlsx</p>

  <div class="summary">
    <table>${summaryRows}</table>
  </div>

  <div class="tabs">${tabsHtml}</div>
  ${contentHtml}

  <script>
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.querySelector('[data-content="' + btn.dataset.tab + '"]').classList.add('active');
      });
    });
  </script>
</body>
</html>`;
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('找不到檔案:', INPUT_FILE);
    console.error('請先執行整併腳本，或指定路徑: node scripts/preview-consolidated.js <xlsx路徑>');
    process.exit(1);
  }

  const workbook = XLSX.readFile(INPUT_FILE);
  const html = generateHtml(workbook);
  fs.writeFileSync(OUTPUT_HTML, html, 'utf8');

  console.log('預覽已產生:', OUTPUT_HTML);
  console.log('在瀏覽器開啟此檔案即可預覽');
}

main();
