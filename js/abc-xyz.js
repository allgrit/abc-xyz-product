(function () {
  const fileInput = document.getElementById('abcFileInput');
  if (!fileInput) return;

  const fileInfoEl = document.getElementById('abcFileInfo');
  const errorEl = document.getElementById('abcError');
  const previewTableBody = document.querySelector('#abcPreviewTable tbody');
  const skuSelect = document.getElementById('abcSkuSelect');
  const warehouseSelect = document.getElementById('abcWarehouseSelect');
  const dateSelect = document.getElementById('abcDateSelect');
  const qtySelect = document.getElementById('abcQtySelect');
  const runBtn = document.getElementById('abcRunBtn');
  const clearBtn = document.getElementById('abcClearBtn');
  const statusEl = document.getElementById('abcStatus');
  const matrixTable = document.getElementById('abcMatrixTable');
  const summaryEl = document.getElementById('abcSummary');
  const treemapEl = document.getElementById('abcTreemap');
  const resultTableBody = document.querySelector('#abcResultTable tbody');

  let rawRows = [];
  let header = [];

  function resetAll() {
    rawRows = [];
    header = [];
    fileInfoEl.textContent = '';
    errorEl.textContent = '';
    statusEl.textContent = '';
    previewTableBody.innerHTML = '';
    resultTableBody.innerHTML = '';
    summaryEl.textContent = '';
    if (treemapEl) {
      treemapEl.innerHTML = '<div class="treemap-empty">Загрузите данные и запустите анализ, чтобы увидеть карту.</div>';
    }
    [skuSelect, warehouseSelect, dateSelect, qtySelect].filter(Boolean).forEach(sel => {
      while (sel.options.length > 1) sel.remove(1);
      sel.value = '';
    });
    if (matrixTable) {
      const cells = matrixTable.querySelectorAll('td[data-cell]');
      cells.forEach(td => {
        td.textContent = '';
        td.style.background = 'transparent';
        td.style.color = '#e5e7eb';
      });
    }
  }

  clearBtn.addEventListener('click', () => {
    fileInput.value = '';
    resetAll();
  });

  fileInput.addEventListener('change', (e) => {
    resetAll();
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      errorEl.textContent = 'Поддерживаются только файлы .xls, .xlsx или .csv.';
      return;
    }
    fileInfoEl.textContent = `Файл: ${file.name} (${(file.size / 1024).toFixed(1)} КБ)`;
    errorEl.textContent = 'Загружаю и разбираю данные…';

    const reader = new FileReader();
    const isCsv = /\.csv$/i.test(file.name);
    
    reader.onload = function (evt) {
      try {
        let workbook;
        if (isCsv) {
          // CSV читаем как текст в windows-1251
          const text = evt.target.result;
          workbook = XLSX.read(text, { type: 'string' });
        } else {
          // xls/xlsx как раньше
          const data = new Uint8Array(evt.target.result);
          workbook = XLSX.read(data, { type: 'array', cellDates: true });
        }
    
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
        if (!rows || rows.length === 0) {
          throw new Error('Пустой лист.');
        }
        header = rows[0].map((v, idx) =>
          (v === null || v === undefined || v === '') ? `Колонка ${idx + 1}` : String(v)
        );
        rawRows = rows.slice(1);
        errorEl.textContent = '';
        statusEl.textContent = 'Выберите соответствие колонок и запустите анализ.';
        fillPreview();
        fillSelectors();
      } catch (err) {
        console.error(err);
        errorEl.textContent = 'Не удалось прочитать файл. Убедитесь, что это корректный Excel/CSV.';
      }
    };
    
    reader.onerror = function () {
      errorEl.textContent = 'Ошибка чтения файла.';
    };
    
    // тут важно: для CSV читаем как текст с кодировкой windows-1251
    if (isCsv) {
      if (reader.readAsText.length === 2) {
        // большинство современных браузеров
        reader.readAsText(file, 'windows-1251');
      } else {
        // fallback, если вдруг параметр не поддерживается
        reader.readAsText(file);
      }
    } else {
      reader.readAsArrayBuffer(file);
    }
    
  });

  function fillPreview() {
    previewTableBody.innerHTML = '';
    const maxRows = Math.min(10, rawRows.length);
    const showHeader = header.length > 0;
    if (showHeader) {
      const tr = document.createElement('tr');
      header.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        th.style.position = 'sticky';
        th.style.top = '0';
        th.style.background = '#020617';
        th.style.color = '#e5e7eb';
        th.style.borderBottom = '1px solid rgba(55,65,81,0.9)';
        th.style.padding = '4px 6px';
        th.style.textAlign = 'left';
        tr.appendChild(th);
      });
      previewTableBody.appendChild(tr);
    }
    for (let i = 0; i < maxRows; i++) {
      const row = rawRows[i];
      const tr = document.createElement('tr');
      row.forEach(val => {
        const td = document.createElement('td');
        td.textContent = (val === null || val === undefined) ? '' : (val instanceof Date ? val.toISOString().slice(0, 10) : String(val));
        td.style.padding = '3px 6px';
        td.style.borderBottom = '1px solid rgba(31,41,55,0.9)';
        td.style.color = '#d1d5db';
        tr.appendChild(td);
      });
      previewTableBody.appendChild(tr);
    }
  }

  function fillSelectors() {
    [skuSelect, warehouseSelect, dateSelect, qtySelect].filter(Boolean).forEach(sel => {
      while (sel.options.length > 1) sel.remove(1);
    });
    header.forEach((h, idx) => {
      [skuSelect, warehouseSelect, dateSelect, qtySelect].filter(Boolean).forEach(sel => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = h;
        sel.appendChild(opt);
      });
    });
  }

  function parseDateCell(v) {
    if (v instanceof Date) return v;
    if (typeof v === 'number') {
      const d = XLSX.SSF.parse_date_code(v);
      if (!d) return null;
      return new Date(Date.UTC(d.y, d.m - 1, d.d));
    }
    if (typeof v === 'string') {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  function runAnalysis() {
    errorEl.textContent = '';
    statusEl.textContent = '';
    resultTableBody.innerHTML = '';
    summaryEl.textContent = '';
    if (!rawRows.length) {
      errorEl.textContent = 'Сначала загрузите файл с данными.';
      return;
    }
    const skuIdx = skuSelect.value === '' ? null : parseInt(skuSelect.value, 10);
    const warehouseIdx = (!warehouseSelect || warehouseSelect.value === '')
      ? null
      : parseInt(warehouseSelect.value, 10);
    const dateIdx = dateSelect.value === '' ? null : parseInt(dateSelect.value, 10);
    const qtyIdx = qtySelect.value === '' ? null : parseInt(qtySelect.value, 10);
    if (skuIdx === null || dateIdx === null || qtyIdx === null || isNaN(skuIdx) || isNaN(dateIdx) || isNaN(qtyIdx)) {
      errorEl.textContent = 'Укажите, какие колонки отвечают за SKU, дату и объём продажи.';
      return;
    }

    const hasWarehouse = warehouseIdx !== null && !isNaN(warehouseIdx);
    const unitShortLabel = hasWarehouse ? 'SKU-склад' : 'SKU';
    const unitLongLabel = hasWarehouse ? 'пар SKU-склад' : 'SKU';

    const skuMap = new Map();
    let minPeriod = null;
    let maxPeriod = null;

    for (const row of rawRows) {
      const skuRaw = row[skuIdx];
      const dateRaw = row[dateIdx];
      const qtyRaw = row[qtyIdx];
      if (skuRaw === null || skuRaw === undefined) continue;
      let sku = String(skuRaw).trim();
      if (!sku) continue;

      const d = parseDateCell(dateRaw);
      if (!d) continue;
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const periodKey = `${year}-${month.toString().padStart(2, '0')}`;

      let qty = parseFloat(qtyRaw);
      if (!isFinite(qty)) continue;

      let warehouse = null;
      if (hasWarehouse) {
        const warehouseRaw = row[warehouseIdx];
        warehouse = (warehouseRaw === null || warehouseRaw === undefined) ? '' : String(warehouseRaw).trim();
      }

      const key = hasWarehouse ? `${sku}|||${warehouse}` : sku;
      if (!skuMap.has(key)) {
        skuMap.set(key, {
          sku,
          warehouse: hasWarehouse ? warehouse : null,
          periods: new Map()
        });
      }
      const entity = skuMap.get(key);
      const pMap = entity.periods;
      const prev = pMap.get(periodKey) || 0;
      pMap.set(periodKey, prev + qty);

      if (!minPeriod || periodKey < minPeriod) minPeriod = periodKey;
      if (!maxPeriod || periodKey > maxPeriod) maxPeriod = periodKey;
    }

    if (!skuMap.size) {
      errorEl.textContent = 'Не удалось собрать данные: проверьте, что в выбранных колонках есть SKU, даты и объёмы.';
      return;
    }

    const periods = [];
    if (minPeriod && maxPeriod) {
      const [minY, minM] = minPeriod.split('-').map(n => parseInt(n, 10));
      const [maxY, maxM] = maxPeriod.split('-').map(n => parseInt(n, 10));
      let y = minY, m = minM;
      while (y < maxY || (y === maxY && m <= maxM)) {
        periods.push(`${y}-${m.toString().padStart(2, '0')}`);
        m++;
        if (m > 12) { m = 1; y++; }
      }
    }

    const skuStats = [];
    let grandTotal = 0;
    for (const entity of skuMap.values()) {
      const { sku, warehouse, periods: pMap } = entity;
      const series = periods.map(p => pMap.get(p) || 0);
      const total = series.reduce((a, b) => a + b, 0);
      grandTotal += total;
      const n = series.length;
      let mean = 0;
      if (n > 0) mean = total / n;
      let variance = 0;
      if (n > 1) {
        const diffs = series.map(q => (q - mean) * (q - mean));
        variance = diffs.reduce((a, b) => a + b, 0) / (n - 1);
      }
      const std = Math.sqrt(variance);
      let cov = null;
      if (mean > 0) cov = std / mean;
      skuStats.push({ sku, warehouse, total, mean, std, cov });
    }

    if (grandTotal <= 0) {
      errorEl.textContent = 'Все объёмы продаж равны нулю — ABC-анализ невозможен.';
      return;
    }

    skuStats.sort((a, b) => b.total - a.total);
    let cum = 0;
    for (const s of skuStats) {
      const share = s.total / grandTotal;
      cum += share;
      if (cum <= 0.8) s.abc = 'A';
      else if (cum <= 0.95) s.abc = 'B';
      else s.abc = 'C';
    }

    for (const s of skuStats) {
      const c = s.cov;
      let xyz;
      if (c === null || !isFinite(c)) {
        xyz = 'Z';
      } else if (c <= 0.10) {
        xyz = 'X';
      } else if (c <= 0.25) {
        xyz = 'Y';
      } else {
        xyz = 'Z';
      }
      s.xyz = xyz;
    }

    const matrixCounts = {
      A: { X: 0, Y: 0, Z: 0 },
      B: { X: 0, Y: 0, Z: 0 },
      C: { X: 0, Y: 0, Z: 0 }
    };
    skuStats.forEach(s => {
      const a = s.abc || 'C';
      const x = s.xyz || 'Z';
      if (matrixCounts[a] && matrixCounts[a][x] !== undefined) {
        matrixCounts[a][x]++;
      }
    });

    renderMatrix(matrixCounts, skuStats.length, unitShortLabel);
    renderSummary(matrixCounts, skuStats.length, unitLongLabel);
    renderTreemap(matrixCounts, unitShortLabel);
    renderTable(skuStats);

    statusEl.textContent = `Готово: обработано ${unitLongLabel} — ${skuStats.length}, периодов — ${periods.length}.`;
  }

  function renderMatrix(matrixCounts, totalSku, unitShortLabel = 'SKU') {
    if (!matrixTable) return;
    const cells = matrixTable.querySelectorAll('td[data-cell]');
    let maxCount = 0;
    cells.forEach(td => {
      const key = td.getAttribute('data-cell');
      const a = key[0];
      const x = key[1];
      const count = (matrixCounts[a] && matrixCounts[a][x]) || 0;
      if (count > maxCount) maxCount = count;
    });

    cells.forEach(td => {
      const key = td.getAttribute('data-cell');
      const a = key[0];
      const x = key[1];
      const count = (matrixCounts[a] && matrixCounts[a][x]) || 0;
      const share = totalSku > 0 ? (count / totalSku * 100) : 0;
      td.textContent = count
        ? `${count} ${unitShortLabel}\n${share.toFixed(1)}%`
        : '—';
      td.style.whiteSpace = 'pre-line';
      if (maxCount > 0 && count > 0) {
        const alpha = 0.15 + 0.6 * (count / maxCount);
        td.style.background = `rgba(59,130,246,${alpha.toFixed(3)})`;
        td.style.color = '#0b1120';
      } else {
        td.style.background = 'transparent';
        td.style.color = '#e5e7eb';
      }
    });
  }

  function renderSummary(matrixCounts, totalSku, unitLongLabel = 'SKU') {
    const totalA = Object.values(matrixCounts.A).reduce((a, b) => a + b, 0);
    const totalB = Object.values(matrixCounts.B).reduce((a, b) => a + b, 0);
    const totalC = Object.values(matrixCounts.C).reduce((a, b) => a + b, 0);
    const fmtPct = (n) => totalSku > 0 ? (n / totalSku * 100).toFixed(1) + '%' : '0%';
    summaryEl.textContent =
      `Всего ${unitLongLabel}: ${totalSku}. ` +
      `Классы ABC: A — ${totalA} (${fmtPct(totalA)}), B — ${totalB} (${fmtPct(totalB)}), C — ${totalC} (${fmtPct(totalC)}).`;
  }

  function renderTreemap(matrixCounts, unitShortLabel = 'SKU') {
    if (!treemapEl) return;
    treemapEl.innerHTML = '';
    const abcOrder = ['A', 'B', 'C'];
    const xyzOrder = ['X', 'Y', 'Z'];
    const total = abcOrder.reduce((sum, a) => {
      return sum + xyzOrder.reduce((inner, x) => inner + ((matrixCounts[a] && matrixCounts[a][x]) || 0), 0);
    }, 0);

    if (!total) {
      treemapEl.innerHTML = '<div class="treemap-empty">Нет данных для визуализации.</div>';
      return;
    }

    const colors = {
      X: ['#134e4a', '#22c55e'],
      Y: ['#78350f', '#f97316'],
      Z: ['#581c87', '#a855f7']
    };

    let offset = 0;
    abcOrder.forEach(a => {
      const rowTotal = xyzOrder.reduce((rowSum, x) => rowSum + ((matrixCounts[a] && matrixCounts[a][x]) || 0), 0);
      if (!rowTotal) return;
      const heightPct = (rowTotal / total) * 100;
      const row = document.createElement('div');
      row.className = 'treemap-row';
      row.style.top = `${offset}%`;
      row.style.height = `${heightPct}%`;

      const rowLabel = document.createElement('div');
      rowLabel.className = 'treemap-row-label';
      rowLabel.textContent = `${a} — ${(rowTotal / total * 100).toFixed(1)}%`;
      row.appendChild(rowLabel);

      let rowOffset = 0;
      xyzOrder.forEach(x => {
        const count = (matrixCounts[a] && matrixCounts[a][x]) || 0;
        if (!count) return;
        const widthPct = (count / rowTotal) * 100;
        const cell = document.createElement('div');
        cell.className = 'treemap-cell';
        cell.style.left = `${rowOffset}%`;
        cell.style.width = `${widthPct}%`;
        const palette = colors[x] || ['#0f172a', '#1f2937'];
        cell.style.background = `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`;
        cell.title = `${a}${x}: ${count} ${unitShortLabel} (${(count / total * 100).toFixed(1)}% от общего числа)`;

        const label = document.createElement('div');
        label.className = 'treemap-cell-label';
        label.innerHTML = `<div>${a}${x}</div><div>${count} ${unitShortLabel}</div>`;
        cell.appendChild(label);

        row.appendChild(cell);
        rowOffset += widthPct;
      });

      treemapEl.appendChild(row);
      offset += heightPct;
    });
  }

  function renderTable(stats) {
    resultTableBody.innerHTML = '';
    stats.forEach(s => {
      const tr = document.createElement('tr');

      const tdSku = document.createElement('td');
      const skuLabel = (s.warehouse !== null && s.warehouse !== undefined)
        ? `${s.sku} / ${s.warehouse || 'без склада'}`
        : s.sku;
      tdSku.textContent = skuLabel;
      tdSku.style.padding = '5px 8px';
      tdSku.style.borderBottom = '1px solid rgba(31,41,55,0.9)';
      tdSku.style.textAlign = 'left';

      const tdTotal = document.createElement('td');
      tdTotal.textContent = s.total.toFixed(2);
      tdTotal.style.padding = '5px 8px';
      tdTotal.style.borderBottom = '1px solid rgba(31,41,55,0.9)';
      tdTotal.style.textAlign = 'right';

      const tdABC = document.createElement('td');
      tdABC.textContent = s.abc || '';
      tdABC.style.padding = '5px 8px';
      tdABC.style.borderBottom = '1px solid rgba(31,41,55,0.9)';
      tdABC.style.textAlign = 'center';

      const tdXYZ = document.createElement('td');
      tdXYZ.textContent = s.xyz || '';
      tdXYZ.style.padding = '5px 8px';
      tdXYZ.style.borderBottom = '1px solid rgba(31,41,55,0.9)';
      tdXYZ.style.textAlign = 'center';

      const tdCov = document.createElement('td');
      tdCov.textContent = (s.cov === null || !isFinite(s.cov)) ? '—' : s.cov.toFixed(3);
      tdCov.style.padding = '5px 8px';
      tdCov.style.borderBottom = '1px solid rgba(31,41,55,0.9)';
      tdCov.style.textAlign = 'right';

      tr.appendChild(tdSku);
      tr.appendChild(tdTotal);
      tr.appendChild(tdABC);
      tr.appendChild(tdXYZ);
      tr.appendChild(tdCov);

      resultTableBody.appendChild(tr);
    });
  }

  runBtn.addEventListener('click', runAnalysis);
})();
