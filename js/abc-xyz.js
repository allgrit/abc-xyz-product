(function () {
  const fileInput = document.getElementById('abcFileInput');
  if (!fileInput) return;

  const fileInfoEl = document.getElementById('abcFileInfo');
  const errorEl = document.getElementById('abcError');
  const previewTableBody = document.querySelector('#abcPreviewTable tbody');
  const skuSelect = document.getElementById('abcSkuSelect');
  const dateSelect = document.getElementById('abcDateSelect');
  const qtySelect = document.getElementById('abcQtySelect');
  const runBtn = document.getElementById('abcRunBtn');
  const clearBtn = document.getElementById('abcClearBtn');
  const demoBtn = document.getElementById('abcDemoBtn');
  const statusEl = document.getElementById('abcStatus');
  const matrixTable = document.getElementById('abcMatrixTable');
  const summaryEl = document.getElementById('abcSummary');
  const treemapEl = document.getElementById('abcTreemap');
  const resultTableBody = document.querySelector('#abcResultTable tbody');
  const scatterContainer = document.getElementById('abcScatter');
  const scatterSvg = document.getElementById('abcScatterSvg');
  const viewTabs = document.querySelectorAll('.abc-view-tab');
  const viewSections = document.querySelectorAll('.abc-view');
  const forecastSkuSelect = document.getElementById('forecastSkuSelect');
  const forecastModelSelect = document.getElementById('forecastModelSelect');
  const forecastHorizonInput = document.getElementById('forecastHorizonInput');
  const forecastWindowInput = document.getElementById('forecastWindowInput');
  const forecastRunBtn = document.getElementById('forecastRunBtn');
  const forecastStatusEl = document.getElementById('forecastStatus');
  const forecastChartSvg = document.getElementById('forecastChart');
  const forecastChartEmpty = document.querySelector('#forecastChartWrapper .forecast-chart-empty');
  const forecastTableBody = document.querySelector('#forecastResultTable tbody');
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let rawRows = [];
  let header = [];
  const forecastDataset = {
    periods: [],
    seriesBySku: new Map()
  };
  let currentView = 'analysis';

  activateView(currentView);
  viewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-view');
      if (!target || target === currentView) return;
      currentView = target;
      activateView(target);
    });
  });

  function resetAll() {
    rawRows = [];
    header = [];
    fileInfoEl.textContent = '';
    errorEl.textContent = '';
    statusEl.textContent = '';
    previewTableBody.innerHTML = '';
    resultTableBody.innerHTML = '';
    summaryEl.textContent = '';
    if (scatterSvg) scatterSvg.innerHTML = '';
    showScatterMessage('Запустите анализ, чтобы увидеть диаграмму рассеяния.');
    if (treemapEl) {
      treemapEl.innerHTML = '<div class="treemap-empty">Загрузите данные и запустите анализ, чтобы увидеть карту.</div>';
    }
    resetForecastState();
    currentView = 'analysis';
    activateView('analysis');
    [skuSelect, dateSelect, qtySelect].forEach(sel => {
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

  function activateView(view) {
    if (!viewSections || !viewTabs) return;
    viewSections.forEach(section => {
      const name = section.getAttribute('data-view');
      section.classList.toggle('active', name === view);
    });
    viewTabs.forEach(tab => {
      const name = tab.getAttribute('data-view');
      tab.classList.toggle('active', name === view);
    });
  }

  function resetForecastState() {
    forecastDataset.periods = [];
    forecastDataset.seriesBySku = new Map();
    if (forecastSkuSelect) {
      forecastSkuSelect.innerHTML = '<option value="">— выберите SKU после загрузки данных —</option>';
      forecastSkuSelect.disabled = true;
    }
    if (forecastModelSelect) {
      forecastModelSelect.value = 'ma';
      forecastModelSelect.disabled = true;
    }
    if (forecastHorizonInput) {
      forecastHorizonInput.value = 6;
      forecastHorizonInput.disabled = true;
    }
    if (forecastWindowInput) {
      forecastWindowInput.value = 3;
      forecastWindowInput.disabled = true;
    }
    if (forecastRunBtn) {
      forecastRunBtn.disabled = true;
    }
    if (forecastStatusEl) {
      forecastStatusEl.textContent = 'Загрузите данные и запустите анализ, чтобы открыть список SKU.';
    }
    if (forecastChartSvg) forecastChartSvg.innerHTML = '';
    showForecastChartMessage('Постройте прогноз, чтобы увидеть график.');
    if (forecastTableBody) forecastTableBody.innerHTML = '';
  }

  function showScatterMessage(text) {
    if (!scatterContainer) return;
    const emptyEl = scatterContainer.querySelector('.scatter-empty');
    if (!emptyEl) return;
    if (typeof text === 'string') emptyEl.textContent = text;
    emptyEl.style.display = 'flex';
  }

  function hideScatterMessage() {
    if (!scatterContainer) return;
    const emptyEl = scatterContainer.querySelector('.scatter-empty');
    if (!emptyEl) return;
    emptyEl.style.display = 'none';
  }

  function showForecastChartMessage(text) {
    if (!forecastChartEmpty) return;
    if (typeof text === 'string') forecastChartEmpty.textContent = text;
    forecastChartEmpty.style.display = 'flex';
  }

  function hideForecastChartMessage() {
    if (!forecastChartEmpty) return;
    forecastChartEmpty.style.display = 'none';
  }

  clearBtn.addEventListener('click', () => {
    fileInput.value = '';
    resetAll();
  });

  if (demoBtn) {
    demoBtn.addEventListener('click', async () => {
      fileInput.value = '';
      resetAll();
      statusEl.textContent = 'Загружаю демо-набор…';
      try {
        const resp = await fetch('./demo-data/abc-xyz-demo.csv', { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        const workbook = XLSX.read(text, { type: 'string' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
        ingestRows(rows, { label: 'Демо-набор: аксессуары (CSV)' });
        statusEl.textContent = 'Демо-данные загружены. Проверьте соответствие колонок и запускайте анализ.';
      } catch (err) {
        console.error(err);
        resetAll();
        errorEl.textContent = 'Не удалось загрузить демо-данные. Попробуйте обновить страницу.';
      }
    });
  }

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
        ingestRows(rows);
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

  function ingestRows(rows, { label = null } = {}) {
    if (!rows || !rows.length) {
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
    autoSelectColumns();
    if (label) {
      fileInfoEl.textContent = label;
    }
  }

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
    [skuSelect, dateSelect, qtySelect].forEach(sel => {
      while (sel.options.length > 1) sel.remove(1);
    });
    header.forEach((h, idx) => {
      [skuSelect, dateSelect, qtySelect].forEach(sel => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = h;
        sel.appendChild(opt);
      });
    });
  }

  function normalizeHeaderName(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'е');
  }

  function autoSelectColumns() {
    if (!header.length) return;
    const normalized = header.map(normalizeHeaderName);
    const pick = (sel, candidates) => {
      if (!sel || sel.value) return;
      const normalizedCandidates = candidates.map(normalizeHeaderName);
      const idx = normalized.findIndex(h => normalizedCandidates.includes(h));
      if (idx >= 0) sel.value = String(idx);
    };

    pick(skuSelect, ['sku', 'артикул', 'товар', 'наименование', 'product']);
    pick(dateSelect, ['дата продажи', 'дата', 'sale date', 'date']);
    pick(qtySelect, ['объем продажи', 'обьем продажи', 'объём продажи', 'qty', 'количество', 'quantity', 'amount']);
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
    const dateIdx = dateSelect.value === '' ? null : parseInt(dateSelect.value, 10);
    const qtyIdx = qtySelect.value === '' ? null : parseInt(qtySelect.value, 10);
    if (skuIdx === null || dateIdx === null || qtyIdx === null || isNaN(skuIdx) || isNaN(dateIdx) || isNaN(qtyIdx)) {
      errorEl.textContent = 'Укажите, какие колонки отвечают за SKU, дату и объём продажи.';
      return;
    }

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

      if (!skuMap.has(sku)) skuMap.set(sku, new Map());
      const pMap = skuMap.get(sku);
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
    for (const [sku, pMap] of skuMap.entries()) {
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
      skuStats.push({ sku, total, mean, std, cov });
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
      s.share = share;
      s.cumShare = cum;
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

    renderMatrix(matrixCounts, skuStats.length);
    renderSummary(matrixCounts, skuStats.length);
    renderScatter(skuStats, grandTotal);
    if (treemapEl) {
      const treemapModule = (typeof window !== 'undefined' && window.ABCXYZTreemap) ? window.ABCXYZTreemap : null;
      if (treemapModule && typeof treemapModule.renderTreemap === 'function') {
        const treemapData = skuStats.map(({ sku, total, abc, xyz }) => ({ sku, total, abc, xyz }));
        treemapModule.renderTreemap(treemapEl, treemapData);
      } else {
        treemapEl.innerHTML = '<div class="treemap-empty">Модуль визуализации недоступен.</div>';
      }
    }
    renderTable(skuStats);
    prepareForecastData(periods, skuMap, skuStats);

    statusEl.textContent = `Готово: обработано SKU — ${skuStats.length}, периодов — ${periods.length}.`;
  }

  function renderMatrix(matrixCounts, totalSku) {
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
        ? `${count} SKU\n${share.toFixed(1)}%`
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

  function renderSummary(matrixCounts, totalSku) {
    const totalA = Object.values(matrixCounts.A).reduce((a, b) => a + b, 0);
    const totalB = Object.values(matrixCounts.B).reduce((a, b) => a + b, 0);
    const totalC = Object.values(matrixCounts.C).reduce((a, b) => a + b, 0);
    const fmtPct = (n) => totalSku > 0 ? (n / totalSku * 100).toFixed(1) + '%' : '0%';
    summaryEl.textContent =
      `Всего SKU: ${totalSku}. ` +
      `Классы ABC: A — ${totalA} (${fmtPct(totalA)}), B — ${totalB} (${fmtPct(totalB)}), C — ${totalC} (${fmtPct(totalC)}).`;
  }

  function renderScatter(stats, grandTotal) {
    if (!scatterSvg) return;
    scatterSvg.innerHTML = '';
    if (!stats.length || !isFinite(grandTotal) || grandTotal <= 0) {
      showScatterMessage('Недостаточно данных для построения диаграммы.');
      return;
    }

    const valid = stats.filter(s => s.cov !== null && isFinite(s.cov) && s.cumShare !== undefined);
    if (!valid.length) {
      showScatterMessage('Нет SKU с ненулевым средним спросом — нечего отобразить.');
      return;
    }

    hideScatterMessage();

    const viewWidth = 640;
    const viewHeight = 360;
    scatterSvg.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`);

    const padding = { top: 24, right: 20, bottom: 52, left: 72 };
    const plotWidth = viewWidth - padding.left - padding.right;
    const plotHeight = viewHeight - padding.top - padding.bottom;

    const covValues = valid.map(v => v.cov);
    let yMax = Math.max(...covValues);
    if (!isFinite(yMax) || yMax <= 0) yMax = 0.5;
    yMax = Math.min(5, Math.max(0.6, yMax * 1.15));

    const xScale = (share) => {
      const clamped = Math.max(0, Math.min(1, share || 0));
      return padding.left + clamped * plotWidth;
    };
    const yScale = (cov) => {
      const clamped = Math.max(0, Math.min(yMax, cov || 0));
      return padding.top + (1 - (clamped / yMax)) * plotHeight;
    };

    const gridGroup = svgEl('g', { class: 'scatter-grid' });
    scatterSvg.appendChild(gridGroup);

    const xTicks = [0, 0.25, 0.5, 0.75, 1];
    xTicks.forEach(tick => {
      const x = xScale(tick);
      const line = svgEl('line', {
        x1: x,
        x2: x,
        y1: padding.top,
        y2: padding.top + plotHeight,
        class: 'scatter-grid-line'
      });
      if (tick !== 0 && tick !== 1) gridGroup.appendChild(line);
      const label = svgEl('text', {
        x,
        y: padding.top + plotHeight + 18,
        class: 'scatter-tick-label',
        'text-anchor': 'middle'
      });
      label.textContent = `${Math.round(tick * 100)}%`;
      scatterSvg.appendChild(label);
    });

    const yStep = niceTickStep(yMax, 4);
    for (let value = 0; value <= yMax + 1e-6; value += yStep) {
      const y = yScale(value);
      if (value > 0) {
        const line = svgEl('line', {
          x1: padding.left,
          x2: padding.left + plotWidth,
          y1: y,
          y2: y,
          class: 'scatter-grid-line'
        });
        gridGroup.appendChild(line);
      }
      const label = svgEl('text', {
        x: padding.left - 10,
        y: y + 4,
        class: 'scatter-tick-label',
        'text-anchor': 'end'
      });
      label.textContent = value.toFixed(value < 1 ? 2 : 1);
      scatterSvg.appendChild(label);
    }

    const axesGroup = svgEl('g');
    axesGroup.appendChild(svgEl('line', {
      x1: padding.left,
      y1: padding.top,
      x2: padding.left,
      y2: padding.top + plotHeight,
      class: 'scatter-axis'
    }));
    axesGroup.appendChild(svgEl('line', {
      x1: padding.left,
      y1: padding.top + plotHeight,
      x2: padding.left + plotWidth,
      y2: padding.top + plotHeight,
      class: 'scatter-axis'
    }));
    scatterSvg.appendChild(axesGroup);

    const axisLabelX = svgEl('text', {
      x: padding.left + plotWidth / 2,
      y: viewHeight - 10,
      class: 'scatter-axis-label',
      'text-anchor': 'middle'
    });
    axisLabelX.textContent = 'Накопленная доля продаж';
    scatterSvg.appendChild(axisLabelX);

    const axisLabelY = svgEl('text', {
      x: 14,
      y: padding.top + plotHeight / 2,
      class: 'scatter-axis-label',
      transform: `rotate(-90 14 ${padding.top + plotHeight / 2})`,
      'text-anchor': 'middle'
    });
    axisLabelY.textContent = 'CoV';
    scatterSvg.appendChild(axisLabelY);

    const refGroup = svgEl('g');
    const abcRefs = [
      { value: 0.8, label: 'граница A/B' },
      { value: 0.95, label: 'граница B/C' }
    ];
    abcRefs.forEach(ref => {
      if (ref.value <= 0 || ref.value >= 1) return;
      const x = xScale(ref.value);
      const line = svgEl('line', {
        x1: x,
        x2: x,
        y1: padding.top,
        y2: padding.top + plotHeight,
        class: 'scatter-ref-line'
      });
      refGroup.appendChild(line);
      const label = svgEl('text', {
        x,
        y: padding.top - 6,
        class: 'scatter-tick-label',
        'text-anchor': 'middle'
      });
      label.textContent = ref.label;
      refGroup.appendChild(label);
    });

    const xyzRefs = [
      { value: 0.10, label: 'граница X/Y' },
      { value: 0.25, label: 'граница Y/Z' }
    ];
    xyzRefs.forEach(ref => {
      if (ref.value <= 0 || ref.value >= yMax) return;
      const y = yScale(ref.value);
      const line = svgEl('line', {
        x1: padding.left,
        x2: padding.left + plotWidth,
        y1: y,
        y2: y,
        class: 'scatter-ref-line scatter-ref-line--horizontal'
      });
      refGroup.appendChild(line);
      const label = svgEl('text', {
        x: padding.left + plotWidth + 4,
        y: y + 4,
        class: 'scatter-tick-label'
      });
      label.textContent = ref.label;
      refGroup.appendChild(label);
    });
    scatterSvg.appendChild(refGroup);

    const pointsGroup = svgEl('g');
    valid.forEach(s => {
      const share = Math.max(0, Math.min(1, s.cumShare || 0));
      const point = svgEl('g', {
        class: 'scatter-point',
        transform: `translate(${xScale(share)},${yScale(s.cov)})`,
        'data-xyz': s.xyz || ''
      });
      const size = 7;
      let shape;
      if (s.abc === 'A') {
        shape = svgEl('path', { d: `M0,-${size} L${size},${size} L-${size},${size} Z` });
      } else if (s.abc === 'B') {
        shape = svgEl('rect', {
          x: -size,
          y: -size,
          width: size * 2,
          height: size * 2,
          rx: 2,
          ry: 2
        });
      } else {
        shape = svgEl('circle', { r: size });
      }
      point.appendChild(shape);
      const label = svgEl('text', {
        'text-anchor': 'middle',
        y: -(size + 6)
      });
      label.textContent = `${s.abc || '?'}${s.xyz || '?'}`;
      point.appendChild(label);
      const title = svgEl('title');
      const sharePct = (share * 100).toFixed(1);
      title.textContent = `${s.sku}: ${s.abc || '?'}${s.xyz || '?'} · доля ${sharePct}% · CoV ${s.cov.toFixed(3)}`;
      point.appendChild(title);
      pointsGroup.appendChild(point);
    });
    scatterSvg.appendChild(pointsGroup);
  }

  function niceTickStep(maxValue, tickCount = 5) {
    if (!isFinite(maxValue) || maxValue <= 0) return 1;
    const raw = maxValue / Math.max(1, tickCount);
    const power = Math.pow(10, Math.floor(Math.log10(raw)));
    let normalized = raw / power;
    if (normalized <= 1) normalized = 1;
    else if (normalized <= 2) normalized = 2;
    else if (normalized <= 5) normalized = 5;
    else normalized = 10;
    return normalized * power;
  }

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      el.setAttribute(key, value);
    });
    return el;
  }

  function renderTable(stats) {
    resultTableBody.innerHTML = '';
    stats.forEach(s => {
      const tr = document.createElement('tr');

      const tdSku = document.createElement('td');
      tdSku.textContent = s.sku;
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

  function prepareForecastData(periods, skuMap, skuStats) {
    forecastDataset.periods = Array.isArray(periods) ? periods.slice() : [];
    forecastDataset.seriesBySku = new Map();
    if (!forecastDataset.periods.length) {
      setForecastControlsDisabled(true);
      if (forecastStatusEl) forecastStatusEl.textContent = 'Недостаточно данных для прогнозирования.';
      return;
    }
    if (skuMap && typeof skuMap.forEach === 'function') {
      skuMap.forEach((periodMap, sku) => {
        const series = forecastDataset.periods.map(period => periodMap.get(period) || 0);
        forecastDataset.seriesBySku.set(sku, series);
      });
    }
    fillForecastSkuOptions(skuStats);
    const hasData = forecastDataset.seriesBySku.size > 0;
    setForecastControlsDisabled(!hasData);
    if (forecastStatusEl) {
      forecastStatusEl.textContent = hasData
        ? 'Выберите SKU и модель, затем нажмите «Построить прогноз». '
        + 'Используются месячные суммы из ABC/XYZ анализа.'
        : 'Нет данных для прогнозирования.';
    }
    if (forecastChartSvg) forecastChartSvg.innerHTML = '';
    showForecastChartMessage('Постройте прогноз, чтобы увидеть график.');
    if (forecastTableBody) forecastTableBody.innerHTML = '';
  }

  function fillForecastSkuOptions(stats = []) {
    if (!forecastSkuSelect) return;
    const prev = forecastSkuSelect.value;
    forecastSkuSelect.innerHTML = '<option value="">— выберите SKU —</option>';
    let items = [];
    if (Array.isArray(stats) && stats.length) {
      items = stats.map(s => s.sku);
    } else {
      items = Array.from(forecastDataset.seriesBySku.keys());
    }
    items.forEach(sku => {
      const opt = document.createElement('option');
      opt.value = sku;
      opt.textContent = sku;
      forecastSkuSelect.appendChild(opt);
    });
    if (items.includes(prev)) forecastSkuSelect.value = prev;
  }

  function setForecastControlsDisabled(disabled) {
    const flag = !!disabled;
    [forecastSkuSelect, forecastModelSelect, forecastHorizonInput, forecastWindowInput, forecastRunBtn]
      .forEach(ctrl => {
        if (ctrl) ctrl.disabled = flag;
      });
  }

  function runForecast() {
    if (!forecastDataset.periods.length) {
      if (forecastStatusEl) forecastStatusEl.textContent = 'Сначала выполните ABC/XYZ анализ.';
      return;
    }
    if (!forecastSkuSelect) return;
    const sku = forecastSkuSelect.value;
    if (!sku) {
      if (forecastStatusEl) forecastStatusEl.textContent = 'Выберите SKU для построения прогноза.';
      return;
    }
    const series = (forecastDataset.seriesBySku.get(sku) || []).map(v => (isFinite(v) ? v : 0));
    if (!series.length) {
      if (forecastStatusEl) forecastStatusEl.textContent = 'Для выбранного SKU нет данных.';
      return;
    }
    if (!series.some(v => v > 0)) {
      if (forecastStatusEl) forecastStatusEl.textContent = 'Ряд состоит из нулей — прогноз бессмыслен.';
      return;
    }
    const horizonRaw = forecastHorizonInput ? parseInt(forecastHorizonInput.value, 10) : 6;
    const horizon = Math.max(1, Math.min(18, isNaN(horizonRaw) ? 6 : horizonRaw));
    if (forecastHorizonInput) forecastHorizonInput.value = horizon;
    const windowRaw = forecastWindowInput ? parseInt(forecastWindowInput.value, 10) : 3;
    const windowSize = Math.max(2, Math.min(24, isNaN(windowRaw) ? 3 : windowRaw));
    if (forecastWindowInput) forecastWindowInput.value = windowSize;
    const modelKey = forecastModelSelect ? forecastModelSelect.value : 'ma';
    let result;
    try {
      if (modelKey === 'holt') {
        result = forecastHoltWinters(series, horizon, windowSize);
      } else if (modelKey === 'arima') {
        result = forecastArima(series, horizon);
      } else if (modelKey === 'trend') {
        result = forecastTrend(series, horizon);
      } else {
        result = forecastMovingAverage(series, horizon, windowSize);
      }
    } catch (err) {
      console.error(err);
      if (forecastStatusEl) forecastStatusEl.textContent = 'Не удалось построить прогноз: ' + err.message;
      return;
    }
    const forecastValues = (result && Array.isArray(result.forecast) ? result.forecast : [])
      .slice(0, horizon)
      .map(v => (isFinite(v) ? Math.max(0, v) : 0));
    const futurePeriods = extendPeriods(forecastDataset.periods, forecastValues.length);
    const rows = buildForecastRows(forecastDataset.periods, series, futurePeriods, forecastValues);
    renderForecastChart(rows);
    renderForecastTable(rows);
    if (forecastStatusEl) {
      const label = (result && result.modelLabel) ? result.modelLabel : 'выбранной модели';
      const extra = (result && result.message) ? ` ${result.message}` : '';
      forecastStatusEl.textContent = `Прогноз (${label}) построен на ${forecastValues.length} мес.${extra}`;
    }
  }

  function buildForecastRows(periods, values, futurePeriods, forecastValues) {
    const rows = [];
    periods.forEach((period, idx) => {
      rows.push({ period, actual: values[idx] ?? 0, forecast: null });
    });
    futurePeriods.forEach((period, idx) => {
      rows.push({ period, actual: null, forecast: forecastValues[idx] ?? null });
    });
    return rows;
  }

  function renderForecastTable(rows) {
    if (!forecastTableBody) return;
    forecastTableBody.innerHTML = '';
    rows.forEach(row => {
      const tr = document.createElement('tr');
      if (row.actual === null || row.actual === undefined) tr.classList.add('future');
      const tdPeriod = document.createElement('td');
      tdPeriod.textContent = row.period;
      const tdActual = document.createElement('td');
      tdActual.textContent = formatForecastValue(row.actual);
      const tdForecast = document.createElement('td');
      tdForecast.textContent = formatForecastValue(row.forecast);
      tr.appendChild(tdPeriod);
      tr.appendChild(tdActual);
      tr.appendChild(tdForecast);
      forecastTableBody.appendChild(tr);
    });
  }

  function formatForecastValue(value) {
    if (value === null || value === undefined) return '—';
    if (!isFinite(value)) return '—';
    return value.toFixed(2);
  }

  function renderForecastChart(rows) {
    if (!forecastChartSvg) return;
    forecastChartSvg.innerHTML = '';
    if (!rows.length) {
      showForecastChartMessage('Нет данных для графика.');
      return;
    }
    const values = rows.map(row => {
      const val = (row.actual !== null && row.actual !== undefined) ? row.actual : row.forecast;
      return (val === null || val === undefined) ? 0 : val;
    });
    const maxValue = Math.max(...values);
    if (!isFinite(maxValue) || maxValue <= 0) {
      showForecastChartMessage('Недостаточно ненулевых значений для графика.');
      return;
    }
    hideForecastChartMessage();
    const viewWidth = 640;
    const viewHeight = 280;
    forecastChartSvg.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`);
    const padding = { top: 16, right: 18, bottom: 40, left: 56 };
    const plotWidth = viewWidth - padding.left - padding.right;
    const plotHeight = viewHeight - padding.top - padding.bottom;
    const xScale = (idx) => {
      if (rows.length <= 1) return padding.left;
      return padding.left + (idx / (rows.length - 1)) * plotWidth;
    };
    const yScale = (value) => {
      const safe = Math.max(0, Math.min(maxValue, value));
      return padding.top + (1 - safe / maxValue) * plotHeight;
    };
    const axisGroup = svgEl('g');
    axisGroup.appendChild(svgEl('line', { x1: padding.left, x2: padding.left, y1: padding.top, y2: padding.top + plotHeight, stroke: 'rgba(148,163,184,0.4)', 'stroke-width': '1' }));
    axisGroup.appendChild(svgEl('line', { x1: padding.left, x2: padding.left + plotWidth, y1: padding.top + plotHeight, y2: padding.top + plotHeight, stroke: 'rgba(148,163,184,0.4)', 'stroke-width': '1' }));
    const yStep = niceTickStep(maxValue, 4);
    for (let value = 0; value <= maxValue + 1e-6; value += yStep) {
      const y = yScale(Math.min(value, maxValue));
      if (value > 0) {
        axisGroup.appendChild(svgEl('line', { x1: padding.left, x2: padding.left + plotWidth, y1: y, y2: y, stroke: 'rgba(148,163,184,0.2)', 'stroke-dasharray': '4 6' }));
      }
      const label = svgEl('text', { x: padding.left - 6, y: y + 4, 'text-anchor': 'end', fill: '#9ca3af', 'font-size': '10' });
      label.textContent = value.toFixed(0);
      axisGroup.appendChild(label);
    }
    const xTickCount = Math.min(rows.length, 6);
    for (let i = 0; i < xTickCount; i++) {
      const idx = xTickCount === 1 ? 0 : Math.round(i * (rows.length - 1) / (xTickCount - 1));
      const x = xScale(idx);
      axisGroup.appendChild(svgEl('line', { x1: x, x2: x, y1: padding.top + plotHeight, y2: padding.top + plotHeight + 4, stroke: 'rgba(148,163,184,0.4)' }));
      const label = svgEl('text', { x, y: padding.top + plotHeight + 16, 'text-anchor': 'middle', fill: '#9ca3af', 'font-size': '10' });
      label.textContent = rows[idx].period;
      axisGroup.appendChild(label);
    }
    forecastChartSvg.appendChild(axisGroup);

    const actualPoints = [];
    rows.forEach((row, idx) => {
      if (row.actual !== null && row.actual !== undefined) {
        actualPoints.push([idx, row.actual]);
      }
    });
    if (actualPoints.length) {
      const actualPath = svgEl('path', {
        d: buildForecastPath(actualPoints, xScale, yScale),
        fill: 'none',
        stroke: '#34d399',
        'stroke-width': 2
      });
      forecastChartSvg.appendChild(actualPath);
    }

    const forecastPoints = [];
    if (actualPoints.length) {
      const lastActual = actualPoints[actualPoints.length - 1];
      forecastPoints.push(lastActual);
    }
    rows.forEach((row, idx) => {
      if (row.forecast !== null && row.forecast !== undefined) {
        forecastPoints.push([idx, row.forecast]);
      }
    });
    if (forecastPoints.length > 1) {
      const forecastPath = svgEl('path', {
        d: buildForecastPath(forecastPoints, xScale, yScale),
        fill: 'none',
        stroke: '#f97316',
        'stroke-width': 2,
        'stroke-dasharray': '6 4'
      });
      forecastChartSvg.appendChild(forecastPath);
    }
  }

  function buildForecastPath(points, xScale, yScale) {
    return points.map((point, idx) => {
      const [xIdx, value] = point;
      const prefix = idx === 0 ? 'M' : 'L';
      return `${prefix}${xScale(xIdx)},${yScale(value)}`;
    }).join(' ');
  }

  function extendPeriods(periods, horizon) {
    const future = [];
    if (!Array.isArray(periods) || !periods.length || horizon <= 0) return future;
    const last = periods[periods.length - 1];
    const [yearStr, monthStr] = last.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10);
    if (isNaN(year) || isNaN(month)) return future;
    for (let i = 0; i < horizon; i++) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      future.push(`${year}-${String(month).padStart(2, '0')}`);
    }
    return future;
  }

  function forecastMovingAverage(series, horizon, windowSize = 3) {
    const window = Math.max(1, Math.min(windowSize, series.length));
    const tail = series.slice(-window);
    const avg = tail.reduce((a, b) => a + b, 0) / window;
    const forecast = Array.from({ length: horizon }, () => avg);
    return {
      forecast,
      modelLabel: `Скользящее среднее (${window} мес.)`,
      message: 'Прогноз равен среднему по последним наблюдениям.'
    };
  }

  function forecastTrend(series, horizon) {
    const n = series.length;
    const xs = series.map((_, idx) => idx + 1);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = series.reduce((a, b) => a + b, 0);
    const sumXY = series.reduce((acc, y, idx) => acc + y * xs[idx], 0);
    const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);
    const denom = n * sumX2 - sumX * sumX;
    const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    const forecast = [];
    for (let i = 1; i <= horizon; i++) {
      const x = n + i;
      forecast.push(intercept + slope * x);
    }
    return {
      forecast,
      modelLabel: 'Линейный тренд',
      message: 'Используется линейная регрессия по времени.'
    };
  }

  function forecastHoltWinters(series, horizon, seasonLength = 6) {
    const data = series.slice();
    const season = Math.max(2, Math.min(seasonLength, data.length));
    const alpha = 0.4;
    const beta = 0.2;
    const gamma = 0.3;
    const seasonals = new Array(season).fill(0);
    for (let i = 0; i < data.length; i++) {
      const idx = i % season;
      seasonals[idx] += data[i];
    }
    for (let i = 0; i < season; i++) {
      seasonals[i] = seasonals[i] / Math.max(1, Math.floor(data.length / season));
    }
    let level = data[0] || 0;
    let trend = data.length > season
      ? (data[season] - data[0]) / season
      : (data[data.length - 1] - data[0]) / Math.max(1, data.length - 1);
    if (!isFinite(trend)) trend = 0;
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      const idx = i % season;
      const prevLevel = level;
      level = alpha * (value - seasonals[idx]) + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
      seasonals[idx] = gamma * (value - level) + (1 - gamma) * seasonals[idx];
    }
    const forecast = [];
    for (let i = 1; i <= horizon; i++) {
      const idx = (data.length + i - 1) % season;
      forecast.push(level + i * trend + seasonals[idx]);
    }
    return {
      forecast,
      modelLabel: `Хольт — Винтерс (L=${season})`,
      message: 'Параметры α=0.4, β=0.2, γ=0.3.'
    };
  }

  function forecastArima(series, horizon) {
    if (series.length < 2) {
      return forecastMovingAverage(series, horizon, 1);
    }
    const diffs = [];
    for (let i = 1; i < series.length; i++) {
      diffs.push(series[i] - series[i - 1]);
    }
    const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    let numerator = 0;
    let denominator = 0;
    for (let i = 1; i < diffs.length; i++) {
      numerator += (diffs[i] - meanDiff) * (diffs[i - 1] - meanDiff);
      denominator += Math.pow(diffs[i - 1] - meanDiff, 2);
    }
    const phi = denominator === 0 ? 0 : numerator / denominator;
    let lastValue = series[series.length - 1];
    let lastDiff = diffs[diffs.length - 1] || meanDiff;
    const forecast = [];
    for (let i = 0; i < horizon; i++) {
      const diffForecast = meanDiff + phi * (lastDiff - meanDiff);
      lastValue = lastValue + diffForecast;
      lastDiff = diffForecast;
      forecast.push(lastValue);
    }
    return {
      forecast,
      modelLabel: 'ARIMA(1,1,0)',
      message: 'Оценены параметры φ и средняя разность.'
    };
  }

  runBtn.addEventListener('click', runAnalysis);
  if (forecastRunBtn) forecastRunBtn.addEventListener('click', runForecast);
})();
