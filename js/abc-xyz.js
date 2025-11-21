(function () {
  function formatDateCell(date) {
    const y = date.getUTCFullYear();
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = date.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseDateCell(v) {
    const buildUtcDate = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
    const isPlausibleYear = (year) => year >= 1950 && year <= 2100;

    const coerceExcelSerial = (num) => {
      if (!isFinite(num)) return null;

      if (typeof XLSX !== 'undefined' && XLSX.SSF && typeof XLSX.SSF.parse_date_code === 'function') {
        const d = XLSX.SSF.parse_date_code(num);
        if (d && isPlausibleYear(d.y)) return buildUtcDate(d.y, d.m, d.d);
      }

      const excelEpoch = Date.UTC(1899, 11, 31);
      const millis = excelEpoch + Math.round(num * 86400000);
      const derived = new Date(millis);
      if (!isNaN(derived.getTime())) {
        const year = derived.getUTCFullYear();
        if (isPlausibleYear(year)) {
          return buildUtcDate(year, derived.getUTCMonth() + 1, derived.getUTCDate());
        }
      }

      return null;
    };

    if (v instanceof Date) {
      const year = v.getUTCFullYear();
      if (!isPlausibleYear(year)) return null;
      return buildUtcDate(year, v.getUTCMonth() + 1, v.getUTCDate());
    }

    if (typeof v === 'number' && isFinite(v)) {
      const derived = coerceExcelSerial(v);
      if (derived) return derived;
    }

    if (typeof v === 'string') {
      const compact = v.trim();
      const numericMatch = compact.match(/^-?\d+(?:\.\d+)?$/);
      if (numericMatch) {
        const numeric = parseFloat(compact);
        const derived = coerceExcelSerial(numeric);
        if (derived) return derived;
      }
      const isoMatch = compact.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      if (isoMatch) {
        const [, y, m, d] = isoMatch.map(part => part && parseInt(part, 10));
        if (y && m && d && isPlausibleYear(y)) return buildUtcDate(y, m, d);
      }

      const ruMatch = compact.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
      if (ruMatch) {
        let [, d, m, y] = ruMatch;
        const day = parseInt(d, 10);
        const month = parseInt(m, 10);
        let year = parseInt(y, 10);
        if (year < 100) year += 2000;
        if (year && month && day && isPlausibleYear(year)) return buildUtcDate(year, month, day);
      }

      const parsed = new Date(compact);
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getUTCFullYear();
        if (isPlausibleYear(year)) {
          return buildUtcDate(year, parsed.getUTCMonth() + 1, parsed.getUTCDate());
        }
      }
    }

    return null;
  }

  function applyViewState(viewSections, viewTabs, view) {
    viewSections.forEach(section => {
      const name = typeof section.getAttribute === 'function' ? section.getAttribute('data-view') : null;
      const isActive = name === view;
      if (section.classList && typeof section.classList.toggle === 'function') {
        section.classList.toggle('active', isActive);
      }
      section.hidden = !isActive;
      if (typeof section.setAttribute === 'function') {
        section.setAttribute('aria-hidden', String(!isActive));
      }
    });
    viewTabs.forEach(tab => {
      const name = typeof tab.getAttribute === 'function' ? tab.getAttribute('data-view') : null;
      const isActive = name === view;
      if (tab.classList && typeof tab.classList.toggle === 'function') {
        tab.classList.toggle('active', isActive);
      }
      if (typeof tab.setAttribute === 'function') {
        tab.setAttribute('aria-selected', String(isActive));
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
      }
    });
  }

  function collectSkuOptions(stats = [], fallbackKeys = []) {
    let items = [];
    if (Array.isArray(stats) && stats.length) {
      items = stats.map(s => s.sku);
    } else if (Array.isArray(fallbackKeys)) {
      items = fallbackKeys;
    }
    return Array.from(new Set(items.filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'ru'));
  }

  function buildMatrixExportData(matrixCounts = {}, totalSku = 0) {
    const headerRow = ['Класс ABC', 'X', 'Y', 'Z', 'Итого', 'Доля от всех SKU'];
    const result = [headerRow];
    const abcOrder = ['A', 'B', 'C'];
    let grandTotal = 0;
    abcOrder.forEach(abc => {
      const rowCounts = matrixCounts[abc] || {};
      const x = Number(rowCounts.X) || 0;
      const y = Number(rowCounts.Y) || 0;
      const z = Number(rowCounts.Z) || 0;
      const subtotal = x + y + z;
      grandTotal += subtotal;
      const share = totalSku > 0 ? (subtotal / totalSku) * 100 : 0;
      result.push([abc, x, y, z, subtotal, share]);
    });
    const grandShare = totalSku > 0 ? (grandTotal / totalSku) * 100 : 0;
    result.push(['Итого',
      Number((matrixCounts.A && matrixCounts.A.X) || 0) + Number((matrixCounts.B && matrixCounts.B.X) || 0) + Number((matrixCounts.C && matrixCounts.C.X) || 0),
      Number((matrixCounts.A && matrixCounts.A.Y) || 0) + Number((matrixCounts.B && matrixCounts.B.Y) || 0) + Number((matrixCounts.C && matrixCounts.C.Y) || 0),
      Number((matrixCounts.A && matrixCounts.A.Z) || 0) + Number((matrixCounts.B && matrixCounts.B.Z) || 0) + Number((matrixCounts.C && matrixCounts.C.Z) || 0),
      grandTotal,
      grandShare
    ]);
    return result;
  }

  function buildSkuExportData(stats = []) {
    const headerRow = ['SKU', 'ABC', 'XYZ', 'Итоговый объём', 'CoV', 'Safety Stock', 'Service Level', 'Доля, %', 'Накопленная доля, %'];
    if (!Array.isArray(stats)) return [headerRow];
    const rows = stats.map(item => [
      item.sku || '',
      item.abc || '',
      item.xyz || '',
      Number(item.total || 0),
      (item.cov === null || !isFinite(item.cov)) ? null : Number(item.cov),
      item.safetyStock !== undefined ? Number(item.safetyStock) : null,
      item.serviceLevel !== undefined ? Number(item.serviceLevel * 100) : null,
      item.share !== undefined ? Number(item.share * 100) : null,
      item.cumShare !== undefined ? Number(item.cumShare * 100) : null
    ]);
    return [headerRow, ...rows];
  }

  function parseWindowSizes(value) {
    if (value === null || value === undefined) return [];
    const raw = Array.isArray(value) ? value.slice() : String(value).split(/[;,\s]+/);
    const nums = raw
      .map(part => parseInt(part, 10))
      .filter(n => Number.isFinite(n) && n > 0);
    return Array.from(new Set(nums)).sort((a, b) => a - b);
  }

  function getFileExtension(file) {
    if (!file) return '';
    const name = typeof file.name === 'string' ? file.name : '';
    const type = typeof file.type === 'string' ? file.type : '';

    const nameMatch = name.toLowerCase().match(/\.([^.]+)$/);
    if (nameMatch && nameMatch[1]) return nameMatch[1];

    if (type === 'text/csv') return 'csv';
    if (type === 'application/vnd.ms-excel') return 'xls';
    if (type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';

    return '';
  }

  function isSupportedFileType(file) {
    const ext = getFileExtension(file);
    return ['xls', 'xlsx', 'csv'].includes(ext);
  }

  function describeFile(file) {
    if (!file) return '';
    const name = typeof file.name === 'string' && file.name.trim() ? file.name : 'Файл';
    const sizeKb = file.size ? (file.size / 1024).toFixed(1) : null;
    return sizeKb ? `Файл: ${name} (${sizeKb} КБ)` : `Файл: ${name}`;
  }

  function buildPeriodSequence(minPeriod, maxPeriod) {
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
    return periods;
  }

  const SERVICE_LEVEL_TARGETS = {
    X: 0.95,
    Y: 0.9,
    Z: 0.85
  };

  function inverseNormalCdf(p) {
    if (p <= 0 || p >= 1) return NaN;
    const a1 = -39.69683028665376;
    const a2 = 220.9460984245205;
    const a3 = -275.9285104469687;
    const a4 = 138.357751867269;
    const a5 = -30.66479806614716;
    const a6 = 2.506628277459239;

    const b1 = -54.47609879822406;
    const b2 = 161.5858368580409;
    const b3 = -155.6989798598866;
    const b4 = 66.80131188771972;
    const b5 = -13.28068155288572;

    const c1 = -0.007784894002430293;
    const c2 = -0.3223964580411365;
    const c3 = -2.400758277161838;
    const c4 = -2.549732539343734;
    const c5 = 4.374664141464968;
    const c6 = 2.938163982698783;

    const d1 = 0.007784695709041462;
    const d2 = 0.3224671290700398;
    const d3 = 2.445134137142996;
    const d4 = 3.754408661907416;

    const plow = 0.02425;
    const phigh = 1 - plow;

    let q, r;
    if (p < plow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
    if (phigh < p) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
    q = p - 0.5;
    r = q * q;
    return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  }

  function getZScore(serviceLevel) {
    const clamped = Math.min(0.999, Math.max(0.001, serviceLevel));
    return inverseNormalCdf(clamped);
  }

  function computeSafetyStock(std, mean, serviceLevel) {
    if (!isFinite(std) || std <= 0) return 0;
    const z = getZScore(serviceLevel);
    if (!isFinite(z)) return 0;
    const base = z * std;
    const meanGuard = isFinite(mean) && mean > 0 ? mean * 0.01 : 0;
    return Math.max(0, base + meanGuard);
  }

  function createEmptyMatrix() {
    return {
      A: { X: 0, Y: 0, Z: 0 },
      B: { X: 0, Y: 0, Z: 0 },
      C: { X: 0, Y: 0, Z: 0 }
    };
  }

  function buildSkuStatsForPeriods(periods = [], skuMap = new Map()) {
    const safePeriods = Array.isArray(periods) ? periods.filter(Boolean) : [];
    const skuStats = [];
    let grandTotal = 0;
    const seriesBySku = new Map();
    const safetyMatrix = createEmptyMatrix();
    let totalSafetyStock = 0;

    skuMap.forEach((pMap, sku) => {
      const series = safePeriods.map(p => (pMap && pMap.get ? (pMap.get(p) || 0) : 0));
      seriesBySku.set(sku, series);
      const total = series.reduce((a, b) => a + b, 0);
      grandTotal += total;
      const n = series.length;
      const mean = n > 0 ? total / n : 0;
      let variance = 0;
      if (n > 1) {
        const diffs = series.map(q => (q - mean) * (q - mean));
        variance = diffs.reduce((a, b) => a + b, 0) / (n - 1);
      }
      const std = Math.sqrt(variance);
      const cov = mean > 0 ? std / mean : null;
      skuStats.push({ sku, total, mean, std, cov });
    });

    if (grandTotal <= 0) {
      return {
        skuStats: [],
        matrixCounts: createEmptyMatrix(),
        totalSku: 0,
        grandTotal: 0,
        periods: safePeriods,
        seriesBySku,
        safetyMatrix,
        totalSafetyStock: 0
      };
    }

    skuStats.sort((a, b) => b.total - a.total);
    let cum = 0;
    const epsilon = 1e-9;
    skuStats.forEach(s => {
      const share = s.total / grandTotal;
      cum += share;
      s.share = share;
      s.cumShare = cum;
      if (cum <= 0.8 + epsilon) s.abc = 'A';
      else if (cum <= 0.95 + epsilon) s.abc = 'B';
      else s.abc = 'C';
    });

    skuStats.forEach(s => {
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
      const serviceLevel = SERVICE_LEVEL_TARGETS[xyz] || SERVICE_LEVEL_TARGETS.Z;
      s.serviceLevel = serviceLevel;
      s.safetyStock = computeSafetyStock(s.std, s.mean, serviceLevel);
      const a = s.abc || 'C';
      const x = s.xyz || 'Z';
      const safety = isFinite(s.safetyStock) ? s.safetyStock : 0;
      if (safetyMatrix[a] && safetyMatrix[a][x] !== undefined) {
        safetyMatrix[a][x] += safety;
      }
      totalSafetyStock += safety;
    });

    const matrixCounts = createEmptyMatrix();
    skuStats.forEach(s => {
      const a = s.abc || 'C';
      const x = s.xyz || 'Z';
      if (matrixCounts[a] && matrixCounts[a][x] !== undefined) {
        matrixCounts[a][x]++;
      }
    });

    return {
      skuStats,
      matrixCounts,
      totalSku: skuStats.length,
      grandTotal,
      periods: safePeriods,
      seriesBySku,
      safetyMatrix,
      totalSafetyStock
    };
  }

  function createWindowResult(periods, skuMap, key, label) {
    const base = buildSkuStatsForPeriods(periods, skuMap);
    return {
      ...base,
      key,
      label,
      startPeriod: periods && periods.length ? periods[0] : null,
      endPeriod: periods && periods.length ? periods[periods.length - 1] : null
    };
  }

  function buildWindowSlices(periods = [], windowSizes = []) {
    const results = [];
    if (!Array.isArray(periods) || !periods.length) return results;
    const sizes = parseWindowSizes(windowSizes);
    sizes.forEach(size => {
      for (let start = 0; start < periods.length; start += size) {
        const chunk = periods.slice(start, start + size);
        if (!chunk.length) continue;
        const label = `${size} мес • ${chunk[0]} — ${chunk[chunk.length - 1]}`;
        results.push({ key: `w${size}-${start}`, label, periods: chunk, size, startPeriod: chunk[0], endPeriod: chunk[chunk.length - 1] });
      }
    });
    results.sort((a, b) => {
      if (a.startPeriod !== b.startPeriod) return a.startPeriod.localeCompare(b.startPeriod);
      return a.size - b.size;
    });
    return results;
  }

  function buildTransitionStats(windowResults = []) {
    const ordered = Array.isArray(windowResults) ? windowResults.slice() : [];
    ordered.sort((a, b) => {
      const startA = a && a.startPeriod ? a.startPeriod : '';
      const startB = b && b.startPeriod ? b.startPeriod : '';
      if (startA !== startB) return startA.localeCompare(startB);
      const endA = a && a.endPeriod ? a.endPeriod : '';
      const endB = b && b.endPeriod ? b.endPeriod : '';
      if (endA !== endB) return endA.localeCompare(endB);
      return String(a && a.key ? a.key : '').localeCompare(String(b && b.key ? b.key : ''));
    });
    const abcMatrix = initTransitionMatrix(['A', 'B', 'C']);
    const xyzMatrix = initTransitionMatrix(['X', 'Y', 'Z']);
    const skuChanges = [];
    const track = new Map();

    ordered.forEach((res, idx) => {
      if (!res || !Array.isArray(res.skuStats)) return;
      res.skuStats.forEach(s => {
        if (!track.has(s.sku)) track.set(s.sku, []);
        track.get(s.sku).push({ order: idx, abc: s.abc, xyz: s.xyz, windowKey: res.key });
      });
    });

    track.forEach((entries, sku) => {
      entries.sort((a, b) => a.order - b.order || a.windowKey.localeCompare(b.windowKey));
      let changes = 0;
      for (let i = 1; i < entries.length; i++) {
        const prev = entries[i - 1];
        const curr = entries[i];
        if (prev.abc && curr.abc && prev.abc !== curr.abc) {
          abcMatrix[prev.abc][curr.abc]++;
          changes++;
        }
        if (prev.xyz && curr.xyz && prev.xyz !== curr.xyz) {
          xyzMatrix[prev.xyz][curr.xyz]++;
          changes++;
        }
      }
      if (changes > 0) skuChanges.push({ sku, changes });
    });

    skuChanges.sort((a, b) => b.changes - a.changes || a.sku.localeCompare(b.sku, 'ru'));

    return { abcMatrix, xyzMatrix, skuChanges };
  }

  function initTransitionMatrix(labels) {
    const matrix = {};
    labels.forEach(from => {
      matrix[from] = {};
      labels.forEach(to => { matrix[from][to] = 0; });
    });
    return matrix;
  }

  function sanitizeSheetName(label) {
    if (!label) return 'ABC_XYZ';
    return String(label).replace(/[:\\/?*\[\]]/g, '').slice(0, 28) || 'Sheet';
  }

  function slugifyLabel(label) {
    return String(label || 'window').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'window';
  }

  function normalizeForecastExportValue(value) {
    if (value === null || value === undefined) return '';
    if (!isFinite(value)) return '';
    return Number(value).toFixed(2);
  }

  function buildForecastTableExportData(rows = []) {
    if (!Array.isArray(rows) || !rows.length) {
      throw new Error('Нет данных прогноза для экспорта');
    }
    const data = [['Период', 'Факт', 'Прогноз']];
    rows.forEach(row => {
      data.push([
        row && row.period ? row.period : '',
        normalizeForecastExportValue(row ? row.actual : undefined),
        normalizeForecastExportValue(row ? row.forecast : undefined)
      ]);
    });
    return data;
  }

  function createOnboardingState(steps = []) {
    const normalizedSteps = Array.isArray(steps) ? steps.slice() : [];
    let activeIndex = -1;

    return {
      get steps() {
        return normalizedSteps;
      },
      get activeIndex() {
        return activeIndex;
      },
      isActive() {
        return activeIndex >= 0 && activeIndex < normalizedSteps.length;
      },
      currentStep() {
        return this.isActive() ? normalizedSteps[activeIndex] : null;
      },
      start() {
        if (!normalizedSteps.length) {
          activeIndex = -1;
          return activeIndex;
        }
        activeIndex = 0;
        return activeIndex;
      },
      next() {
        if (!normalizedSteps.length) return -1;
        if (activeIndex < normalizedSteps.length - 1) {
          activeIndex += 1;
        }
        return activeIndex;
      },
      prev() {
        if (!normalizedSteps.length) return -1;
        if (activeIndex > 0) {
          activeIndex -= 1;
        }
        return activeIndex;
      },
      finish() {
        activeIndex = -1;
        return activeIndex;
      }
    };
  }

  function applyOnboardingLoadingState({
    overlay,
    titleEl,
    textEl,
    stepEl,
    actionEl,
    prevBtn,
    nextBtn,
    body
  } = {}) {
    if (overlay) overlay.hidden = false;
    if (body && body.classList && typeof body.classList.add === 'function') {
      body.classList.add('onboarding-open');
    }
    if (titleEl) titleEl.textContent = 'Готовим тур';
    if (textEl) textEl.textContent = 'Загружаем демо-данные и рассчитываем матрицу…';
    if (stepEl) stepEl.textContent = 'Подготовка тура';
    if (actionEl) actionEl.textContent = 'Это займёт меньше минуты. Подождите, пожалуйста.';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.textContent = 'Загружаю…';
    }
  }

  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = {
        applyViewState,
        collectSkuOptions,
        parseDateCell,
        formatDateCell,
        buildMatrixExportData,
        buildSkuExportData,
        buildForecastTableExportData,
        parseWindowSizes,
        buildPeriodSequence,
        buildSkuStatsForPeriods,
        buildTransitionStats,
        createOnboardingState,
        applyOnboardingLoadingState,
        getFileExtension,
        isSupportedFileType,
        describeFile
      };
    }
    return;
  }

  const fileInput = document.getElementById('abcFileInput');
  if (!fileInput) return;

  const fileInfoEl = document.getElementById('abcFileInfo');
  const errorEl = document.getElementById('abcError');
  const previewTableBody = document.querySelector('#abcPreviewTable tbody');
  const skuSelect = document.getElementById('abcSkuSelect');
  const dateSelect = document.getElementById('abcDateSelect');
  const qtySelect = document.getElementById('abcQtySelect');
  const windowSizesInput = document.getElementById('abcWindowSizesInput');
  const windowSelect = document.getElementById('abcWindowSelect');
  const runBtn = document.getElementById('abcRunBtn');
  const clearBtn = document.getElementById('abcClearBtn');
  const demoBtn = document.getElementById('abcDemoBtn');
  const tourBtn = document.getElementById('abcTourBtn');
  const statusEl = document.getElementById('abcStatus');
  const matrixTable = document.getElementById('abcMatrixTable');
  const summaryEl = document.getElementById('abcSummary');
  const windowHintEl = document.getElementById('abcWindowHint');
  const treemapEl = document.getElementById('abcTreemap');
  const resultTableBody = document.querySelector('#abcResultTable tbody');
  const scatterContainer = document.getElementById('abcScatter');
  const scatterSvg = document.getElementById('abcScatterSvg');
  const matrixExportCsvBtn = document.getElementById('matrixExportCsvBtn');
  const matrixExportXlsxBtn = document.getElementById('matrixExportXlsxBtn');
  const tableExportCsvBtn = document.getElementById('tableExportCsvBtn');
  const tableExportXlsxBtn = document.getElementById('tableExportXlsxBtn');
  const treemapExportSvgBtn = document.getElementById('treemapExportSvgBtn');
  const treemapExportPngBtn = document.getElementById('treemapExportPngBtn');
  const scatterExportSvgBtn = document.getElementById('scatterExportSvgBtn');
  const scatterExportPngBtn = document.getElementById('scatterExportPngBtn');
  const uploadPanel = document.getElementById('abcUploadPanel');
  const dropArea = document.getElementById('abcDropArea');
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
  const forecastChartExportSvgBtn = document.getElementById('forecastChartExportSvgBtn');
  const forecastChartExportPngBtn = document.getElementById('forecastChartExportPngBtn');
  const forecastTableExportCsvBtn = document.getElementById('forecastTableExportCsvBtn');
  const forecastTableExportXlsxBtn = document.getElementById('forecastTableExportXlsxBtn');
  const abcTransitionTable = document.getElementById('abcTransitionTable');
  const xyzTransitionTable = document.getElementById('xyzTransitionTable');
  const skuChangeList = document.getElementById('abcSkuChangeList');
  const onboardingOverlay = document.getElementById('abcOnboarding');
  const onboardingTitleEl = document.getElementById('abcOnboardingTitle');
  const onboardingTextEl = document.getElementById('abcOnboardingText');
  const onboardingStepEl = document.getElementById('abcOnboardingStep');
  const onboardingNextBtn = document.getElementById('abcOnboardingNext');
  const onboardingPrevBtn = document.getElementById('abcOnboardingPrev');
  const onboardingCloseBtn = document.getElementById('abcOnboardingClose');
  const onboardingActionHint = document.getElementById('abcOnboardingAction');
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let rawRows = [];
  let header = [];
  const analysisState = {
    matrixCounts: null,
    totalSku: 0,
    skuStats: [],
    grandTotal: 0,
    periods: [],
    safetyMatrix: null,
    totalSafetyStock: 0,
    windowResults: new Map(),
    activeWindowKey: null,
    transitions: null
  };
  let forecastRows = [];
  const forecastDataset = {
    periods: [],
    seriesBySku: new Map()
  };
  const onboardingState = createOnboardingState(buildOnboardingSteps());
  let highlightedEl = null;
  let currentView = 'analysis';

  activateView(currentView);
  viewTabs.forEach(tab => {
    tab.setAttribute('role', 'tab');
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
    if (windowHintEl) windowHintEl.textContent = '';
    analysisState.matrixCounts = null;
    analysisState.totalSku = 0;
    analysisState.skuStats = [];
    analysisState.grandTotal = 0;
    analysisState.periods = [];
    analysisState.safetyMatrix = null;
    analysisState.totalSafetyStock = 0;
    analysisState.windowResults = new Map();
    analysisState.activeWindowKey = null;
    analysisState.transitions = null;
    stopOnboarding();
    if (scatterSvg) scatterSvg.innerHTML = '';
    showScatterMessage('Запустите анализ, чтобы увидеть диаграмму рассеяния.');
    if (treemapEl) {
      treemapEl.innerHTML = '<div class="treemap-empty">Загрузите данные и запустите анализ, чтобы увидеть карту.</div>';
    }
    setExportAvailability(false);
    resetForecastState();
    currentView = 'analysis';
    activateView('analysis');
    [skuSelect, dateSelect, qtySelect].forEach(sel => {
      while (sel.options.length > 1) sel.remove(1);
      sel.value = '';
    });
    if (windowSelect) {
      windowSelect.innerHTML = '<option value="">— появятся после анализа —</option>';
      windowSelect.disabled = true;
    }
    if (abcTransitionTable) abcTransitionTable.innerHTML = '';
    if (xyzTransitionTable) xyzTransitionTable.innerHTML = '';
    if (skuChangeList) skuChangeList.innerHTML = '';
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
    applyViewState(viewSections, viewTabs, view);
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
      forecastStatusEl.textContent = 'Начните с ABC/XYZ анализа: после загрузки данных здесь появится список SKU для прогноза.';
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

  async function loadDemoData({ withOnboarding = false } = {}) {
    fileInput.value = '';
    resetAll();
    statusEl.textContent = 'Загружаю демо-набор…';
    if (withOnboarding) {
      showOnboardingLoading();
    }
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
      if (withOnboarding) {
        startOnboarding({ autoRun: true });
      }
    } catch (err) {
      console.error(err);
      resetAll();
      errorEl.textContent = 'Не удалось загрузить демо-данные. Попробуйте обновить страницу.';
    }
  }

  if (demoBtn) {
    demoBtn.addEventListener('click', () => loadDemoData({ withOnboarding: true }));
  }

  if (tourBtn) {
    tourBtn.addEventListener('click', () => {
      if (!rawRows.length) {
        loadDemoData({ withOnboarding: true });
      } else {
        startOnboarding({ autoRun: true });
      }
    });
  }

  [matrixExportCsvBtn, matrixExportXlsxBtn, tableExportCsvBtn, tableExportXlsxBtn,
    treemapExportSvgBtn, treemapExportPngBtn, scatterExportSvgBtn, scatterExportPngBtn]
    .forEach(btn => { if (btn) btn.disabled = true; });

  function setDropState(isActive) {
    if (dropArea && dropArea.classList) {
      dropArea.classList.toggle('drop-active', Boolean(isActive));
    }
  }

  function handleFileSelection(file, { sourceLabel = 'Файл' } = {}) {
    resetAll();
    fileInput.value = '';

    if (!file) {
      errorEl.textContent = sourceLabel === 'Буфер обмена'
        ? 'В буфере обмена нет файла. Скопируйте Excel или CSV и попробуйте снова.'
        : 'Файл не найден. Перетащите .xls/.xlsx/.csv или выберите его вручную.';
      fileInfoEl.textContent = '';
      return;
    }

    if (!isSupportedFileType(file)) {
      errorEl.textContent = 'Поддерживаются только файлы .xls, .xlsx или .csv.';
      fileInfoEl.textContent = describeFile(file);
      return;
    }

    fileInfoEl.textContent = describeFile(file);
    errorEl.textContent = 'Загружаю и разбираю данные…';

    const reader = new FileReader();
    const ext = getFileExtension(file);
    const isCsv = ext === 'csv';

    reader.onload = function (evt) {
      try {
        let workbook;
        if (isCsv) {
          const text = evt.target.result;
          workbook = XLSX.read(text, { type: 'string' });
        } else {
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

    if (isCsv) {
      if (reader.readAsText.length === 2) {
        reader.readAsText(file, 'windows-1251');
      } else {
        reader.readAsText(file);
      }
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    handleFileSelection(file, { sourceLabel: 'Загрузка файла' });
  });

  let dragDepth = 0;
  if (uploadPanel) {
    uploadPanel.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragDepth++;
      setDropState(true);
    });

    uploadPanel.addEventListener('dragover', (e) => {
      e.preventDefault();
      setDropState(true);
    });

    uploadPanel.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        setDropState(false);
      }
    });

    uploadPanel.addEventListener('drop', (e) => {
      e.preventDefault();
      dragDepth = 0;
      setDropState(false);
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      handleFileSelection(file, { sourceLabel: 'Перетаскивание' });
    });

    uploadPanel.addEventListener('paste', (e) => {
      if (!e.clipboardData || !e.clipboardData.files || !e.clipboardData.files.length) return;
      e.preventDefault();
      setDropState(true);
      setTimeout(() => setDropState(false), 150);
      const file = e.clipboardData.files[0];
      handleFileSelection(file, { sourceLabel: 'Буфер обмена' });
    });
  }

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
        let cellText = '';
        if (val !== null && val !== undefined) {
          const parsed = parseDateCell(val);
          if (parsed) {
            cellText = formatDateCell(parsed);
          } else if (val instanceof Date) {
            cellText = formatDateCell(val);
          } else {
            cellText = String(val);
          }
        }
        td.textContent = cellText;
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

  function buildOnboardingSteps() {
    return [
      {
        key: 'demo-load',
        title: 'Демо-данные уже в работе',
        text: 'Мы загрузили набор продаж аксессуаров и показали первые строки. Можно сразу переходить к шагам.',
        target: '#abcPreviewWrapper',
        action: 'Проверьте превью и листайте дальше.'
      },
      {
        key: 'mapping',
        title: 'Автоподбор колонок',
        text: 'Поле SKU, дата и объём уже выбраны. При необходимости можно поправить.',
        target: '#abcSkuSelect',
        action: 'Оставьте автоподбор или выберите свои колонки.'
      },
      {
        key: 'run',
        title: 'Запуск анализа',
        text: 'Жмём одну кнопку: матрица, treemap и таблицы появятся автоматически.',
        target: '#abcRunBtn',
        action: 'Нажмите «Запустить анализ» — для демо мы сделаем это автоматически.'
      },
      {
        key: 'matrix',
        title: 'Матрица ABC/XYZ с подсказками',
        text: 'Каждая ячейка показывает количество SKU и рекомендуемый уровень сервиса.',
        target: '#abcMatrixTable',
        action: 'Наведите курсор на ячейки, чтобы увидеть детали.'
      },
      {
        key: 'window',
        title: 'Окна анализа и динамика',
        text: 'Переключайтесь между окнами, чтобы сравнить стабильность спроса по периодам.',
        target: '#abcWindowSelect',
        action: 'Выберите окно 6 или 12 месяцев для сравнения.'
      },
      {
        key: 'views',
        title: 'Дополнительные вкладки',
        text: 'Меняйте вкладки интерфейса: ABC/XYZ, прогноз и динамика классов.',
        target: '.abc-view-tab[data-view="forecast"]',
        action: 'Откройте вкладку «Прогноз», чтобы построить график.'
      },
      {
        key: 'forecast',
        title: 'Быстрый прогноз по SKU',
        text: 'Выберите SKU и модель — график прогнозов появится сразу.',
        target: '#forecastChartWrapper',
        action: 'Выберите SKU и нажмите «Построить прогноз».'
      }
    ];
  }

  function ensureColumnSelection() {
    if (!skuSelect.value || !dateSelect.value || !qtySelect.value) {
      autoSelectColumns();
    }
    return skuSelect.value && dateSelect.value && qtySelect.value;
  }

  function showOnboardingLoading() {
    applyHighlight(null);
    applyOnboardingLoadingState({
      overlay: onboardingOverlay,
      titleEl: onboardingTitleEl,
      textEl: onboardingTextEl,
      stepEl: onboardingStepEl,
      actionEl: onboardingActionHint,
      prevBtn: onboardingPrevBtn,
      nextBtn: onboardingNextBtn,
      body: document.body
    });
  }

  function startOnboarding({ autoRun = false } = {}) {
    if (!onboardingOverlay || !onboardingState.steps.length) return;
    onboardingState.start();
    if (autoRun && rawRows.length && ensureColumnSelection()) {
      try {
        runAnalysis();
      } catch (err) {
        console.error('Onboarding auto-run failed', err);
      }
    }
    renderOnboardingStep();
  }

  function renderOnboardingStep() {
    const step = onboardingState.currentStep();
    if (!step || !onboardingOverlay) return;
    onboardingOverlay.hidden = false;
    document.body.classList.add('onboarding-open');
    if (onboardingStepEl) onboardingStepEl.textContent = `Шаг ${onboardingState.activeIndex + 1} из ${onboardingState.steps.length}`;
    if (onboardingTitleEl) onboardingTitleEl.textContent = step.title || '';
    if (onboardingTextEl) onboardingTextEl.textContent = step.text || '';
    if (onboardingActionHint) onboardingActionHint.textContent = step.action || '';
    if (typeof step.onEnter === 'function') {
      step.onEnter();
    }
    applyHighlight(step.target);
    if (onboardingPrevBtn) onboardingPrevBtn.disabled = onboardingState.activeIndex <= 0;
    if (onboardingNextBtn) {
      onboardingNextBtn.disabled = false;
      const isLast = onboardingState.activeIndex >= onboardingState.steps.length - 1;
      onboardingNextBtn.textContent = isLast ? 'Завершить' : 'Дальше';
    }
  }

  function applyHighlight(selector) {
    if (highlightedEl && highlightedEl.classList) {
      highlightedEl.classList.remove('onboarding-highlight');
    }
    if (!selector) {
      highlightedEl = null;
      return;
    }
    const target = document.querySelector(selector);
    if (target && target.classList) {
      target.classList.add('onboarding-highlight');
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err) {
        console.warn('scrollIntoView error', err);
      }
    }
    highlightedEl = target || null;
  }

  function stopOnboarding() {
    onboardingState.finish();
    if (highlightedEl && highlightedEl.classList) {
      highlightedEl.classList.remove('onboarding-highlight');
    }
    highlightedEl = null;
    if (onboardingOverlay) onboardingOverlay.hidden = true;
    document.body.classList.remove('onboarding-open');
  }

  function handleOnboardingNext() {
    if (!onboardingState.isActive()) {
      startOnboarding();
      return;
    }
    const isLast = onboardingState.activeIndex >= onboardingState.steps.length - 1;
    if (isLast) {
      stopOnboarding();
      return;
    }
    onboardingState.next();
    renderOnboardingStep();
  }

  function handleOnboardingPrev() {
    if (!onboardingState.isActive()) return;
    onboardingState.prev();
    renderOnboardingStep();
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
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
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

    const periods = buildPeriodSequence(minPeriod, maxPeriod);
    const baseLabel = periods.length
      ? `Весь период (${periods[0]} — ${periods[periods.length - 1]})`
      : 'Весь период';

    const windowResults = new Map();
    const overallResult = createWindowResult(periods, skuMap, 'all', baseLabel);
    if (overallResult.grandTotal <= 0) {
      errorEl.textContent = 'Все объёмы продаж равны нулю — ABC-анализ невозможен.';
      return;
    }
    windowResults.set('all', overallResult);

    const selectedSizes = parseWindowSizes(windowSizesInput ? windowSizesInput.value : '');
    const slices = buildWindowSlices(periods, selectedSizes);
    const sliceResults = slices.map(slice => {
      const res = createWindowResult(slice.periods, skuMap, slice.key, slice.label);
      windowResults.set(slice.key, res);
      return res;
    });

    analysisState.windowResults = windowResults;
    analysisState.transitions = sliceResults.length ? buildTransitionStats(sliceResults.filter(r => r.totalSku > 0)) : null;
    updateDynamicsView(analysisState.transitions);

    const preferredWindow = sliceResults.filter(r => r.totalSku > 0).slice(-1)[0] || overallResult;
    fillWindowSelectOptions(windowResults, preferredWindow.key);
    setActiveWindow(preferredWindow.key);
    statusEl.textContent = `Готово: обработано SKU — ${overallResult.totalSku}, периодов — ${periods.length}. Окон: ${Math.max(sliceResults.length, 1)}.`;
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

  function setActiveWindow(key) {
    if (!analysisState.windowResults || !analysisState.windowResults.size) return;
    const fallback = analysisState.windowResults.get('all');
    const target = analysisState.windowResults.get(key) || fallback;
    if (!target) return;

    analysisState.activeWindowKey = target.key;
    analysisState.matrixCounts = target.matrixCounts;
    analysisState.totalSku = target.totalSku;
    analysisState.skuStats = target.skuStats.slice();
    analysisState.grandTotal = target.grandTotal;
    analysisState.periods = target.periods.slice();
    analysisState.safetyMatrix = target.safetyMatrix;
    analysisState.totalSafetyStock = target.totalSafetyStock;

    if (windowSelect && windowSelect.options.length) {
      windowSelect.value = target.key;
      windowSelect.disabled = false;
    }
    if (windowHintEl) windowHintEl.textContent = target.label || '';

    renderMatrix(target.matrixCounts, target.totalSku);
    renderSummary(target.matrixCounts, target.totalSku, target.safetyMatrix, target.totalSafetyStock);
    renderScatter(target.skuStats, target.grandTotal);
    renderTable(target.skuStats);

    if (treemapEl) {
      const treemapModule = (typeof window !== 'undefined' && window.ABCXYZTreemap) ? window.ABCXYZTreemap : null;
      if (treemapModule && typeof treemapModule.renderTreemap === 'function' && target.skuStats.length) {
        const treemapData = target.skuStats.map(({ sku, total, abc, xyz }) => ({ sku, total, abc, xyz }));
        treemapModule.renderTreemap(treemapEl, treemapData);
      } else {
        treemapEl.innerHTML = '<div class="treemap-empty">Модуль визуализации недоступен или нет данных.</div>';
      }
    }

    if (target.totalSku > 0) {
      const filteredMap = new Map();
      if (target.seriesBySku && typeof target.seriesBySku.forEach === 'function') {
        target.seriesBySku.forEach((series, sku) => {
          const pMap = new Map();
          target.periods.forEach((p, idx) => {
            const v = series[idx] || 0;
            pMap.set(p, v);
          });
          filteredMap.set(sku, pMap);
        });
      }
      prepareForecastData(target.periods, filteredMap, target.skuStats);
    } else {
      resetForecastState();
    }
    setExportAvailability(target.totalSku > 0);
  }

  function fillWindowSelectOptions(windowResults, activeKey) {
    if (!windowSelect) return;
    const options = [];
    if (windowResults && typeof windowResults.forEach === 'function') {
      windowResults.forEach(res => { if (res) options.push(res); });
    }
    options.sort((a, b) => {
      if (a.startPeriod && b.startPeriod && a.startPeriod !== b.startPeriod) return a.startPeriod.localeCompare(b.startPeriod);
      return String(a.label || a.key).localeCompare(String(b.label || b.key), 'ru');
    });
    windowSelect.innerHTML = '';
    options.forEach(res => {
      const opt = document.createElement('option');
      opt.value = res.key;
      opt.textContent = res.label || res.key;
      windowSelect.appendChild(opt);
    });
    windowSelect.disabled = options.length === 0;
    if (activeKey && windowResults.has(activeKey)) {
      windowSelect.value = activeKey;
    } else if (options.length) {
      windowSelect.value = options[0].key;
    }
  }

  function setExportAvailability(enabled) {
    [matrixExportCsvBtn, matrixExportXlsxBtn, tableExportCsvBtn, tableExportXlsxBtn,
      treemapExportSvgBtn, treemapExportPngBtn, scatterExportSvgBtn, scatterExportPngBtn]
      .forEach(btn => { if (btn) btn.disabled = !enabled; });
  }

  function exportMatrix(format = 'csv') {
    try {
      if (!analysisState.windowResults || !analysisState.windowResults.size) throw new Error('Нет данных матрицы');
      const formatSafe = format === 'xlsx' ? 'xlsx' : 'csv';
      const hasXlsx = typeof XLSX !== 'undefined' && XLSX.utils;
      const effectiveFormat = (formatSafe === 'xlsx' && hasXlsx) ? 'xlsx' : 'csv';
      const available = Array.from(analysisState.windowResults.values())
        .filter(res => res && res.totalSku > 0);
      if (!available.length) throw new Error('Нет данных матрицы');

      if (effectiveFormat === 'xlsx') {
        const workbook = XLSX.utils.book_new();
        available.forEach((res, idx) => {
          const sheetData = [[`Окно: ${res.label || res.key}`], ...buildMatrixExportData(res.matrixCounts, res.totalSku)];
          const sheet = XLSX.utils.aoa_to_sheet(sheetData);
          XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(res.label || `Окно ${idx + 1}`));
        });
        const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        triggerDownload(arrayBuffer, 'abc-xyz-matrix.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        statusEl.textContent = 'Матрицы сохранены в XLSX (несколько листов).';
        return;
      }

      if (effectiveFormat === 'csv' && available.length > 1) {
        available.forEach(res => {
          const data = buildMatrixExportData(res.matrixCounts, res.totalSku);
          downloadTableData(data, `abc-xyz-matrix-${slugifyLabel(res.label)}`, 'csv');
        });
        statusEl.textContent = `Матрицы по ${available.length} окнам сохранены как CSV.`;
        return;
      }

      const active = analysisState.windowResults.get(analysisState.activeWindowKey) || available[0];
      const data = buildMatrixExportData(active.matrixCounts, active.totalSku);
      downloadTableData(data, 'abc-xyz-matrix', effectiveFormat);
      const suffix = (formatSafe === 'xlsx' && !hasXlsx) ? ' (XLSX недоступен, сохранено в CSV)' : '';
      statusEl.textContent = `Матрица сохранена в ${effectiveFormat.toUpperCase()} (локально).${suffix}`;
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Не удалось сохранить матрицу.';
    }
  }

  function exportSkuTable(format = 'csv') {
    try {
      if (!analysisState.skuStats.length) throw new Error('Нет данных по SKU');
      const data = buildSkuExportData(analysisState.skuStats);
      downloadTableData(data, 'abc-xyz-table', format);
      statusEl.textContent = `Таблица по SKU сохранена в ${format.toUpperCase()} (файл не уходит с устройства).`;
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Не удалось сохранить таблицу.';
    }
  }

  function exportTreemap(format = 'svg') {
    try {
      const treemapModule = (typeof window !== 'undefined' && window.ABCXYZTreemap) ? window.ABCXYZTreemap : null;
      if (!treemapModule || typeof treemapModule.buildTreemapExportSvg !== 'function') {
        statusEl.textContent = 'Модуль экспорта treemap недоступен.';
        return;
      }
      const svgText = treemapModule.buildTreemapExportSvg(treemapEl, { title: 'Treemap ABC/XYZ' });
      if (!svgText) {
        statusEl.textContent = 'Нет данных для сохранения treemap.';
        return;
      }
      if (format === 'svg') {
        triggerDownload(svgText, 'abc-xyz-treemap.svg', 'image/svg+xml');
        statusEl.textContent = 'Treemap сохранена как SVG (локально).';
      } else {
        svgTextToPng(svgText, 960, 540)
          .then(blob => {
            triggerDownload(blob, 'abc-xyz-treemap.png', 'image/png');
            statusEl.textContent = 'Treemap сохранена как PNG (локально).';
          })
          .catch(err => {
            console.error(err);
            statusEl.textContent = 'Не удалось сохранить treemap в PNG.';
          });
      }
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Ошибка при сохранении treemap.';
    }
  }

  function exportScatter(format = 'svg') {
    try {
      if (!scatterSvg || !scatterSvg.innerHTML.trim()) {
        statusEl.textContent = 'Диаграмма ещё не построена.';
        return;
      }
      const svgText = serializeSvgElement(scatterSvg);
      const size = parseViewBox(scatterSvg.getAttribute('viewBox')) || { width: 640, height: 360 };
      if (format === 'svg') {
        triggerDownload(svgText, 'abc-xyz-scatter.svg', 'image/svg+xml');
        statusEl.textContent = 'Диаграмма рассеяния сохранена как SVG (локально).';
      } else {
        svgTextToPng(svgText, size.width, size.height)
          .then(blob => {
            triggerDownload(blob, 'abc-xyz-scatter.png', 'image/png');
            statusEl.textContent = 'Диаграмма рассеяния сохранена как PNG (локально).';
          })
          .catch(err => {
            console.error(err);
            statusEl.textContent = 'Не удалось сохранить диаграмму в PNG.';
          });
      }
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Ошибка при сохранении диаграммы.';
    }
  }

  function downloadTableData(data, fileBase, format = 'csv') {
    if (!Array.isArray(data) || !data.length) {
      throw new Error('Нет данных для сохранения');
    }
    const safeFormat = (format === 'xlsx') ? 'xlsx' : 'csv';
    const hasXlsx = typeof XLSX !== 'undefined' && XLSX.utils;
    if (safeFormat === 'xlsx' && hasXlsx) {
      const sheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'ABC_XYZ');
      const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      triggerDownload(arrayBuffer, `${fileBase}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return;
    }
    const csv = hasXlsx && XLSX.utils.sheet_to_csv
      ? XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(data), { FS: ';' })
      : arrayToCsv(data);
    triggerDownload(csv, `${fileBase}.csv`, 'text/csv;charset=utf-8');
  }

  function arrayToCsv(data) {
    return data.map(row => row.map(cell => escapeCsvCell(cell)).join(';')).join('\n');
  }

  function escapeCsvCell(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[";\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function triggerDownload(content, filename, mime) {
    let blob;
    if (content instanceof Blob) {
      blob = content;
    } else if (content instanceof ArrayBuffer) {
      blob = new Blob([content], { type: mime || 'application/octet-stream' });
    } else {
      blob = new Blob([content], { type: mime || 'application/octet-stream' });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function serializeSvgElement(svgEl) {
    const clone = svgEl.cloneNode(true);
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    return new XMLSerializer().serializeToString(clone);
  }

  function parseViewBox(viewBoxValue) {
    if (!viewBoxValue) return null;
    const parts = viewBoxValue.split(/\s+/).map(Number).filter(n => !isNaN(n));
    if (parts.length === 4) {
      return { width: parts[2], height: parts[3] };
    }
    return null;
  }

  function svgTextToPng(svgText, width, height) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(width));
          canvas.height = Math.max(1, Math.round(height));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Не удалось построить PNG'));
          });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Ошибка загрузки SVG для PNG'));
      };
      img.src = url;
    });
  }

  function renderSummary(matrixCounts, totalSku, safetyMatrix = createEmptyMatrix(), totalSafetyStock = 0) {
    if (!matrixCounts || !matrixCounts.A || !matrixCounts.B || !matrixCounts.C) {
      summaryEl.textContent = 'Нет данных для сводки ABC/XYZ — запустите анализ.';
      return;
    }
    const totalA = Object.values(matrixCounts.A).reduce((a, b) => a + b, 0);
    const totalB = Object.values(matrixCounts.B).reduce((a, b) => a + b, 0);
    const totalC = Object.values(matrixCounts.C).reduce((a, b) => a + b, 0);
    const fmtPct = (n) => totalSku > 0 ? (n / totalSku * 100).toFixed(1) + '%' : '0%';
    const fmtNum = (n) => Number(n || 0).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const fmtService = (cls) => Math.round((SERVICE_LEVEL_TARGETS[cls] || SERVICE_LEVEL_TARGETS.Z) * 100);
    const safeTotal = Number.isFinite(totalSafetyStock) ? totalSafetyStock : 0;
    const safetyByQuadrant = ['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ'].map(key => {
      const abc = key[0];
      const xyz = key[1];
      const val = safetyMatrix && safetyMatrix[abc] && safetyMatrix[abc][xyz] ? safetyMatrix[abc][xyz] : 0;
      return { key, value: val, service: fmtService(xyz) };
    });

    const policyNotes = {
      AX: 'Критичный ассортимент: держать максимальный сервис и ежемесячно корректировать параметры пополнения.',
      AY: 'Приоритетный товар со средней вариативностью: страховой запас на уровне 90% сервиса с проверкой сезонности.',
      AZ: 'Важные, но шумные SKU: гибкий запас под кампании, фокус на быстрой реактивности.',
      BX: 'Стабильные SKU класса B: сервис 95%, пополнение по тренду и регулярный мониторинг оборачиваемости.',
      BY: 'Средняя важность и изменчивость: сервис 90%, буфер на 1–2 периода поставки.',
      BZ: 'Переменные B: сервис 85%, страховой запас минимальный и пересматривается по факту спроса.',
      CX: 'Стабильные низкоприоритетные: сервис 95% допускает редкие поставки крупными партиями.',
      CY: 'Низкий приоритет и вариативность: сервис 90% только на критичный период поставки.',
      CZ: 'Минимальный приоритет: страховой запас как исключение, пополнение под заказ при сервисе 85%.'
    };

    const safetyList = safetyByQuadrant.map(item => `<li><strong>${item.key}</strong>: ${fmtNum(item.value)} (сервис ${item.service}%) — ${policyNotes[item.key]}</li>`).join('');

    summaryEl.innerHTML = `
      <div>Всего SKU: <strong>${totalSku}</strong>. Классы ABC: A — ${totalA} (${fmtPct(totalA)}), B — ${totalB} (${fmtPct(totalB)}), C — ${totalC} (${fmtPct(totalC)}).</div>
      <div>Целевой уровень сервиса по XYZ: X — ${fmtService('X')}%, Y — ${fmtService('Y')}%, Z — ${fmtService('Z')}%.</div>
      <div>Суммарный страховой запас по матрице: <strong>${fmtNum(safeTotal)}</strong>. Детализация по квадрантам:</div>
      <ul class="abc-summary-list">${safetyList}</ul>
    `;
  }

  function updateDynamicsView(transitions) {
    if (!abcTransitionTable || !xyzTransitionTable || !skuChangeList) return;
    if (!transitions) {
      abcTransitionTable.innerHTML = '<tr><td>Нет данных по переходам.</td></tr>';
      xyzTransitionTable.innerHTML = '<tr><td>Нет данных по переходам.</td></tr>';
      skuChangeList.innerHTML = '<li>Нет изменений между окнами.</li>';
      return;
    }
    renderTransitionTable(abcTransitionTable, transitions.abcMatrix, ['A', 'B', 'C']);
    renderTransitionTable(xyzTransitionTable, transitions.xyzMatrix, ['X', 'Y', 'Z']);
    renderSkuChangeList(transitions.skuChanges);
  }

  function renderTransitionTable(tableEl, matrix, labels) {
    if (!tableEl) return;
    tableEl.innerHTML = '';
    const headerRow = document.createElement('tr');
    headerRow.appendChild(document.createElement('th'));
    labels.forEach(label => {
      const th = document.createElement('th');
      th.textContent = label;
      headerRow.appendChild(th);
    });
    tableEl.appendChild(headerRow);

    let max = 0;
    labels.forEach(from => {
      labels.forEach(to => {
        const val = (matrix && matrix[from] && matrix[from][to]) || 0;
        if (val > max) max = val;
      });
    });

    labels.forEach(from => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = from;
      tr.appendChild(th);
      labels.forEach(to => {
        const val = (matrix && matrix[from] && matrix[from][to]) || 0;
        const td = document.createElement('td');
        td.textContent = val || '—';
        if (val > 0 && max > 0) {
          const alpha = 0.2 + 0.6 * (val / max);
          td.style.backgroundColor = `rgba(59,130,246,${alpha.toFixed(3)})`;
          td.style.color = '#0b1120';
        }
        tr.appendChild(td);
      });
      tableEl.appendChild(tr);
    });
  }

  function renderSkuChangeList(changes = []) {
    if (!skuChangeList) return;
    skuChangeList.innerHTML = '';
    if (!changes.length) {
      const li = document.createElement('li');
      li.textContent = 'Изменений между окнами не обнаружено.';
      skuChangeList.appendChild(li);
      return;
    }
    changes.slice(0, 6).forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.sku} — ${item.changes} смен класса`;
      skuChangeList.appendChild(li);
    });
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

      const tdSafety = document.createElement('td');
      tdSafety.textContent = (s.safetyStock === null || s.safetyStock === undefined || !isFinite(s.safetyStock))
        ? '—'
        : s.safetyStock.toFixed(2);
      tdSafety.style.padding = '5px 8px';
      tdSafety.style.borderBottom = '1px solid rgba(31,41,55,0.9)';
      tdSafety.style.textAlign = 'right';

      const tdService = document.createElement('td');
      tdService.textContent = (s.serviceLevel === null || s.serviceLevel === undefined || !isFinite(s.serviceLevel))
        ? '—'
        : `${Math.round(s.serviceLevel * 100)}%`;
      tdService.style.padding = '5px 8px';
      tdService.style.borderBottom = '1px solid rgba(31,41,55,0.9)';
      tdService.style.textAlign = 'center';

      tr.appendChild(tdSku);
      tr.appendChild(tdTotal);
      tr.appendChild(tdABC);
      tr.appendChild(tdXYZ);
      tr.appendChild(tdCov);
      tr.appendChild(tdSafety);
      tr.appendChild(tdService);

      resultTableBody.appendChild(tr);
    });
  }

  function prepareForecastData(periods, skuMap, skuStats) {
    forecastDataset.periods = Array.isArray(periods) ? periods.slice() : [];
    forecastDataset.seriesBySku = new Map();
    forecastRows = [];
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
    const unique = collectSkuOptions(stats, Array.from(forecastDataset.seriesBySku.keys()));
    unique.forEach(sku => {
      const opt = document.createElement('option');
      opt.value = sku;
      opt.textContent = sku;
      forecastSkuSelect.appendChild(opt);
    });
    if (unique.includes(prev)) forecastSkuSelect.value = prev;
  }

  function setForecastControlsDisabled(disabled) {
    const flag = !!disabled;
    [forecastSkuSelect, forecastModelSelect, forecastHorizonInput, forecastWindowInput, forecastRunBtn]
      .forEach(ctrl => {
        if (ctrl) ctrl.disabled = flag;
      });
  }

  function runForecast() {
    forecastRows = [];
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
    forecastRows = rows;
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

  function exportForecastChart(format = 'svg') {
    try {
      if (!forecastChartSvg || !forecastChartSvg.innerHTML.trim()) {
        if (forecastStatusEl) forecastStatusEl.textContent = 'График прогноза ещё не построен.';
        return;
      }
      const svgText = serializeSvgElement(forecastChartSvg);
      const size = parseViewBox(forecastChartSvg.getAttribute('viewBox')) || { width: 640, height: 280 };
      if (format === 'svg') {
        triggerDownload(svgText, 'abc-xyz-forecast.svg', 'image/svg+xml');
        if (forecastStatusEl) forecastStatusEl.textContent = 'График прогноза сохранён как SVG (локально).';
      } else {
        svgTextToPng(svgText, size.width, size.height)
          .then(blob => {
            triggerDownload(blob, 'abc-xyz-forecast.png', 'image/png');
            if (forecastStatusEl) forecastStatusEl.textContent = 'График прогноза сохранён как PNG (локально).';
          })
          .catch(err => {
            console.error(err);
            if (forecastStatusEl) forecastStatusEl.textContent = 'Не удалось сохранить график прогноза в PNG.';
          });
      }
    } catch (err) {
      console.error(err);
      if (forecastStatusEl) forecastStatusEl.textContent = 'Ошибка при сохранении графика прогноза.';
    }
  }

  function exportForecastTable(format = 'csv') {
    try {
      const data = buildForecastTableExportData(forecastRows);
      downloadTableData(data, 'abc-xyz-forecast', format);
      if (forecastStatusEl) {
        const label = format === 'xlsx' ? 'XLSX' : 'CSV';
        forecastStatusEl.textContent = `Таблица прогноза сохранена в ${label} (локально).`;
      }
    } catch (err) {
      console.error(err);
      if (forecastStatusEl) forecastStatusEl.textContent = 'Не удалось сохранить таблицу прогноза.';
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
  if (onboardingNextBtn) onboardingNextBtn.addEventListener('click', handleOnboardingNext);
  if (onboardingPrevBtn) onboardingPrevBtn.addEventListener('click', handleOnboardingPrev);
  if (onboardingCloseBtn) onboardingCloseBtn.addEventListener('click', stopOnboarding);
  if (onboardingOverlay) {
    onboardingOverlay.addEventListener('click', (evt) => {
      if (evt.target === onboardingOverlay) stopOnboarding();
    });
  }

  if (matrixExportCsvBtn) matrixExportCsvBtn.addEventListener('click', () => exportMatrix('csv'));
  if (matrixExportXlsxBtn) matrixExportXlsxBtn.addEventListener('click', () => exportMatrix('xlsx'));
  if (tableExportCsvBtn) tableExportCsvBtn.addEventListener('click', () => exportSkuTable('csv'));
  if (tableExportXlsxBtn) tableExportXlsxBtn.addEventListener('click', () => exportSkuTable('xlsx'));
  if (treemapExportSvgBtn) treemapExportSvgBtn.addEventListener('click', () => exportTreemap('svg'));
  if (treemapExportPngBtn) treemapExportPngBtn.addEventListener('click', () => exportTreemap('png'));
  if (scatterExportSvgBtn) scatterExportSvgBtn.addEventListener('click', () => exportScatter('svg'));
  if (scatterExportPngBtn) scatterExportPngBtn.addEventListener('click', () => exportScatter('png'));
  if (forecastChartExportSvgBtn) forecastChartExportSvgBtn.addEventListener('click', () => exportForecastChart('svg'));
  if (forecastChartExportPngBtn) forecastChartExportPngBtn.addEventListener('click', () => exportForecastChart('png'));
  if (forecastTableExportCsvBtn) forecastTableExportCsvBtn.addEventListener('click', () => exportForecastTable('csv'));
  if (forecastTableExportXlsxBtn) forecastTableExportXlsxBtn.addEventListener('click', () => exportForecastTable('xlsx'));
  if (windowSelect) windowSelect.addEventListener('change', () => setActiveWindow(windowSelect.value));

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      applyViewState,
      collectSkuOptions,
      activateView,
      prepareForecastData,
      fillForecastSkuOptions,
      forecastDataset,
      buildMatrixExportData,
      buildSkuExportData,
      buildForecastTableExportData,
      parseWindowSizes,
      buildPeriodSequence,
      buildSkuStatsForPeriods,
      buildTransitionStats,
      applyOnboardingLoadingState
    };
  }
})();
