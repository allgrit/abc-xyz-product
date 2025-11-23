const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyRibbonState,
  applyStepState,
  collectSkuOptions,
  parseDateCell,
  formatDateCell,
  buildMatrixExportData,
  buildSkuExportData,
  buildForecastTableExportData,
  buildAutoSelectionRows,
  guessColumnMapping,
  validateRowsForSelection,
  formatValidationWarnings,
  parseWindowSizes,
  buildPeriodSequence,
  buildSkuStatsForPeriods,
  buildTransitionStats,
  createOnboardingState,
  applyOnboardingLoadingState,
  applyClassFilters,
  buildAggregatesFromStats,
  formatFilterState,
  getFileExtension,
  isSupportedFileType,
  describeFile,
  selectBestForecastModel,
  selectBestIntermittentModel,
  resolveForecastParameters,
  autoTuneWindowAndHorizon,
  forecastEtsAuto,
  autoArima,
  runArimaModel,
  computeAic,
  intermittentShare,
  forecastCroston,
  forecastSba,
  forecastTsb,
  ensureXlsxReady
} = require('../js/abc-xyz');

function makeStubEl(value, attr = 'data-view') {
  const classes = new Set();
  return {
    hidden: false,
    attributes: { [attr]: value },
    classList: {
      add: (cls) => classes.add(cls),
      remove: (cls) => classes.delete(cls),
      toggle: (cls, flag) => {
        if (flag) classes.add(cls); else classes.delete(cls);
      },
      contains: cls => classes.has(cls)
    },
    setAttribute(key, value) {
      this.attributes[key] = String(value);
    },
    getAttribute(key) {
      return this.attributes[key];
    },
    removeAttribute(key) {
      delete this.attributes[key];
    },
    querySelectorAll() {
      return [];
    }
  };
}

function makeStepStub(attr, value) {
  const classes = new Set();
  return {
    hidden: false,
    attributes: { [attr]: value },
    classList: {
      add: (cls) => classes.add(cls),
      remove: (cls) => classes.delete(cls),
      toggle: (cls, flag) => {
        if (flag) classes.add(cls); else classes.delete(cls);
      },
      contains: cls => classes.has(cls)
    },
    setAttribute(key, val) {
      this.attributes[key] = String(val);
    },
    getAttribute(key) {
      return this.attributes[key];
    },
    removeAttribute(key) {
      delete this.attributes[key];
    }
  };
}

function makeControl(requirement) {
  const attrs = requirement ? { 'data-requires': requirement } : {};
  return {
    disabled: false,
    attributes: attrs,
    setAttribute(key, val) {
      this.attributes[key] = String(val);
    },
    getAttribute(key) {
      return this.attributes[key];
    }
  };
}

test('applyRibbonState переключает вкладки ленты и доступность команд', () => {
  const sectionAnalysis = makeStubEl('analysis');
  const sectionForecast = makeStubEl('forecast');
  const tabAnalysis = makeStubEl('analysis', 'data-ribbon');
  tabAnalysis.setAttribute('data-view-target', 'analysis');
  const tabForecast = makeStubEl('forecast', 'data-ribbon');
  tabForecast.setAttribute('data-view-target', 'forecast');
  const exportButton = makeControl('analysisResults');
  const analysisPanel = makeStubEl('analysis', 'data-ribbon');
  analysisPanel.querySelectorAll = (selector) => selector === '[data-requires]' ? [exportButton] : [];
  const forecastPanel = makeStubEl('forecast', 'data-ribbon');
  forecastPanel.querySelectorAll = () => [];

  applyRibbonState(
    [analysisPanel, forecastPanel],
    [tabAnalysis, tabForecast],
    [sectionAnalysis, sectionForecast],
    { activeTab: 'analysis', activeView: 'analysis' },
    { analysisResults: false }
  );

  assert.equal(analysisPanel.hidden, false);
  assert.equal(forecastPanel.hidden, true);
  assert.equal(sectionAnalysis.hidden, false);
  assert.equal(sectionForecast.hidden, true);
  assert.equal(exportButton.disabled, true);
  assert.equal(tabAnalysis.attributes['aria-selected'], 'true');

  applyRibbonState(
    [analysisPanel, forecastPanel],
    [tabAnalysis, tabForecast],
    [sectionAnalysis, sectionForecast],
    { activeTab: 'forecast', activeView: 'forecast' },
    { analysisResults: true }
  );

  assert.equal(forecastPanel.hidden, false);
  assert.equal(sectionForecast.hidden, false);
  assert.equal(sectionAnalysis.hidden, true);
  assert.equal(exportButton.disabled, false);
  assert.equal(tabForecast.attributes['aria-selected'], 'true');
  assert.equal(tabForecast.attributes.tabindex, '0');
});

test('applyStepState toggles steps and visibility for mobile flow', () => {
  const stepUpload = makeStepStub('data-step-panel', 'upload');
  const stepResults = makeStepStub('data-step-panel', 'results');
  const tabUpload = makeStepStub('data-step-tab', 'upload');
  const tabResults = makeStepStub('data-step-tab', 'results');

  applyStepState([stepUpload, stepResults], [tabUpload, tabResults], 'results', true);

  assert.equal(stepUpload.hidden, true);
  assert.equal(stepUpload.attributes['aria-hidden'], 'true');
  assert.equal(stepResults.hidden, false);
  assert.equal(tabResults.attributes['aria-selected'], 'true');
  assert.equal(tabResults.attributes.tabindex, '0');

  applyStepState([stepUpload, stepResults], [tabUpload, tabResults], 'upload', false);

  assert.equal(stepUpload.hidden, false);
  assert.ok(!stepUpload.attributes['aria-hidden']);
  assert.equal(stepResults.hidden, false);
});

test('collectSkuOptions deduplicates and sorts SKUs with fallback keys', () => {
  const fromStats = collectSkuOptions([
    { sku: 'B-001' },
    { sku: 'a-101' },
    { sku: 'B-001' }
  ]);
  assert.deepEqual(fromStats, ['a-101', 'B-001']);

  const fallbackOnly = collectSkuOptions([], ['Z-9', 'A-1', 'Z-9']);
  assert.deepEqual(fallbackOnly, ['A-1', 'Z-9']);
});

test('parseDateCell handles Excel serial numbers without XLSX', () => {
  const date = parseDateCell(45123); // 2023-07-17
  assert.ok(date instanceof Date);
  assert.equal(formatDateCell(date), '2023-07-17');
});

test('parseDateCell coerces numeric strings into Excel serial dates', () => {
  const date = parseDateCell('45123');
  assert.ok(date instanceof Date);
  assert.equal(formatDateCell(date), '2023-07-17');
});

test('parseDateCell ignores unrealistic Excel serial numbers', () => {
  assert.equal(parseDateCell(33), null); // 1900-02-02 — не должен считаться датой продаж
  assert.equal(parseDateCell('120.5'), null);
});

test('ensureXlsxReady сообщает об отсутствии XLSX', () => {
  const original = global.XLSX;
  try {
    delete global.XLSX;
    assert.throws(() => ensureXlsxReady(), { code: 'XLSX_NOT_AVAILABLE' });

    global.XLSX = { read: () => {} };
    assert.doesNotThrow(() => ensureXlsxReady());
  } finally {
    global.XLSX = original;
  }
});

test('parseDateCell parses RU-style and ISO-style dates consistently', () => {
  const ruDate = parseDateCell('16.07.2023');
  const isoDate = parseDateCell('2023-07-16');
  assert.ok(ruDate instanceof Date);
  assert.ok(isoDate instanceof Date);
  assert.equal(ruDate.getTime(), isoDate.getTime());
  assert.equal(formatDateCell(ruDate), '2023-07-16');
});

test('parseDateCell normalizes Date instances using UTC parts', () => {
  const localDate = new Date('2023-12-05T23:00:00-02:00');
  const parsed = parseDateCell(localDate);
  assert.equal(formatDateCell(parsed), '2023-12-06');
});

test('buildMatrixExportData собирает таблицу с итогами по ABC/XYZ', () => {
  const data = buildMatrixExportData({
    A: { X: 2, Y: 1, Z: 0 },
    B: { X: 0, Y: 3, Z: 1 },
    C: { X: 1, Y: 0, Z: 4 }
  }, 12);

  assert.deepEqual(data[0], ['Класс ABC', 'X', 'Y', 'Z', 'Итого', 'Доля от всех SKU']);
  const totalsRow = data[data.length - 1];
  assert.equal(totalsRow[1], 3); // X итого
  assert.equal(totalsRow[4], 12); // всего sku в матрице
  assert.ok(Number.isFinite(totalsRow[5]));
});

test('buildSkuExportData добавляет сервис, страховой запас и проценты', () => {
  const data = buildSkuExportData([
    { sku: 'A-1', total: 10, abc: 'A', xyz: 'X', cov: 0.12, safetyStock: 2.3, serviceLevel: 0.95, share: 0.5, cumShare: 0.5 },
    { sku: 'B-2', total: 4, abc: 'B', xyz: 'Y', cov: null, safetyStock: 0, serviceLevel: 0.9, share: 0.2, cumShare: 0.7 }
  ]);

  assert.equal(data[0][0], 'SKU');
  assert.equal(data[0].length, 10);
  assert.equal(data[1][6], 2.3);
  assert.equal(data[1][7], 95);
  assert.equal(data[1][8], 50); // share в процентах
  assert.equal(data[2][5], null); // пустой cov превращается в null
  assert.equal(data.length, 3);
});

test('buildSkuStatsForPeriods добавляет группу SKU из мэппинга', () => {
  const periods = ['2023-01', '2023-02'];
  const skuMap = new Map([
    ['S-1', new Map([['2023-01', 2], ['2023-02', 3]])]
  ]);
  const groupBySku = new Map([['S-1', 'Audio']]);

  const result = buildSkuStatsForPeriods(periods, skuMap, groupBySku);

  assert.equal(result.skuStats[0].group, 'Audio');
});

test('buildForecastTableExportData конвертирует ряды в таблицу с округлением', () => {
  const rows = [
    { period: '2023-01', actual: 10, forecast: null },
    { period: '2023-02', actual: null, forecast: 12.3456 },
    { period: '2023-03', actual: Infinity, forecast: 7 }
  ];

  const data = buildForecastTableExportData(rows);

  assert.deepEqual(data[0], ['Период', 'Факт', 'Прогноз']);
  assert.equal(data[1][1], '10.00');
  assert.equal(data[2][1], '');
  assert.equal(data[2][2], '12.35');
  assert.equal(data[3][1], '');
  assert.equal(data[3][2], '7.00');
});

test('buildForecastTableExportData выбрасывает ошибку при пустых данных', () => {
  assert.throws(() => buildForecastTableExportData([]), /Нет данных прогноза/);
});

test('buildAutoSelectionRows выводит переданный статус ошибки', () => {
  const rows = buildAutoSelectionRows([
    { key: 'boom', label: 'Faulty', metrics: { mae: Infinity, smape: Infinity }, status: 'Ошибка: boom' }
  ], 'boom');

  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'Ошибка: boom');
  assert.equal(rows[0].isBest, true);
});

test('parseWindowSizes нормализует список окон', () => {
  assert.deepEqual(parseWindowSizes('6, 3; 6 9'), [3, 6, 9]);
  assert.deepEqual(parseWindowSizes(['2', '4', '4']), [2, 4]);
});

test('applyClassFilters учитывает выбранные классы ABC и XYZ', () => {
  const stats = [
    { sku: 'A1', abc: 'A', xyz: 'X' },
    { sku: 'B2', abc: 'B', xyz: 'Y' },
    { sku: 'C3', abc: 'C', xyz: 'Z' }
  ];
  const filtered = applyClassFilters(stats, { abc: new Set(['A', 'B']), xyz: new Set(['X', 'Y']) });
  assert.equal(filtered.length, 2);
  assert.ok(filtered.every(item => item.abc !== 'C'));
});

test('applyClassFilters учитывает группы и поиск', () => {
  const stats = [
    { sku: 'ABC-1', abc: 'A', xyz: 'X', group: 'Игрушки' },
    { sku: 'ZZZ-2', abc: 'B', xyz: 'Y', group: 'Одежда' },
    { sku: 'ABC-3', abc: 'A', xyz: 'Z', group: 'Одежда' }
  ];

  const byGroup = applyClassFilters(stats, {
    abc: new Set(['A', 'B', 'C']),
    xyz: new Set(['X', 'Y', 'Z']),
    groups: new Set(['Одежда']),
    skuQuery: ''
  });

  assert.deepEqual(byGroup.map(s => s.sku), ['ZZZ-2', 'ABC-3']);

  const withSearch = applyClassFilters(stats, {
    abc: new Set(['A']),
    xyz: new Set(['X', 'Z']),
    groups: new Set(),
    skuQuery: 'abc'
  });

  assert.deepEqual(withSearch.map(s => s.sku), ['ABC-1', 'ABC-3']);
});

test('buildAggregatesFromStats подсчитывает матрицу и safety stock', () => {
  const aggregates = buildAggregatesFromStats([
    { abc: 'A', xyz: 'X', safetyStock: 5 },
    { abc: 'A', xyz: 'X', safetyStock: 3 },
    { abc: 'C', xyz: 'Z', safetyStock: 2 }
  ]);

  assert.equal(aggregates.matrixCounts.A.X, 2);
  assert.equal(aggregates.matrixCounts.C.Z, 1);
  assert.equal(aggregates.totalSku, 3);
  assert.equal(aggregates.safetyMatrix.A.X, 8);
  assert.equal(aggregates.totalSafetyStock, 10);
});

test('formatFilterState собирает читаемый статус фильтров', () => {
  const state = { abc: new Set(['A', 'C']), xyz: new Set(['X']) };
  const text = formatFilterState(state);
  assert.match(text, /ABC: A, C/);
  assert.match(text, /XYZ: X/);
});

test('guessColumnMapping учитывает тип данных и предполагает роли колонок', () => {
  const headers = ['item_code', 'category', 'sold_on', 'units'];
  const rows = [
    ['SKU-1', 'Audio', '2023-01-01', '10'],
    ['SKU-2', 'Audio', '2023-01-02', 5],
    ['SKU-3', 'Cables', '2023-01-03', '7']
  ];

  const guess = guessColumnMapping(headers, rows);

  assert.equal(guess.sku.idx, 0);
  assert.equal(guess.group.idx, 1);
  assert.equal(guess.date.idx, 2);
  assert.equal(guess.qty.idx, 3);
});

test('validateRowsForSelection находит ошибки формата и дубликаты', () => {
  const rows = [
    ['S1', 'CatA', '2023-01-01', 10],
    ['S1', 'CatA', '2023-01-01', 5],
    ['S2', 'CatB', 'не дата', 3],
    ['S2', 'CatB', '2023-01-02', 'oops'],
    ['S3', '', '2023-01-03', 1]
  ];

  const validation = validateRowsForSelection(rows, { skuIdx: 0, groupIdx: 1, dateIdx: 2, qtyIdx: 3, maxRows: 10 });

  assert.equal(validation.invalidDates, 1);
  assert.equal(validation.invalidQty, 1);
  assert.equal(validation.emptyGroups, 1);
  assert.equal(validation.duplicateKeys, 1);
  assert.equal(validation.scanned, 3);
  assert.equal(validation.truncated, false);

  const warningText = formatValidationWarnings(validation);
  assert.ok(warningText.includes('дубликатов'));
  assert.ok(warningText.includes('товарной группы'));
  assert.ok(warningText.startsWith('⚠️'));
});

test('getFileExtension достаёт расширение из имени или MIME', () => {
  assert.equal(getFileExtension({ name: 'report.XLSX' }), 'xlsx');
  assert.equal(getFileExtension({ name: 'file', type: 'text/csv' }), 'csv');
  assert.equal(getFileExtension({ type: 'application/vnd.ms-excel' }), 'xls');
  assert.equal(getFileExtension({ type: 'text/plain' }), '');
});

test('isSupportedFileType проверяет Excel и CSV', () => {
  assert.equal(isSupportedFileType({ name: 'data.csv' }), true);
  assert.equal(isSupportedFileType({ name: 'data.pdf' }), false);
  assert.equal(isSupportedFileType({ type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), true);
});

test('describeFile формирует подпись с размером', () => {
  const description = describeFile({ name: 'demo.xlsx', size: 2048 });
  assert.ok(description.includes('demo.xlsx'));
  assert.ok(description.includes('2.0'));
  assert.equal(describeFile(null), '');
});

test('buildPeriodSequence перечисляет месяцы в диапазоне', () => {
  const periods = buildPeriodSequence('2023-01', '2023-03');
  assert.deepEqual(periods, ['2023-01', '2023-02', '2023-03']);
});

test('buildPeriodSequence поддерживает дневной шаг', () => {
  const periods = buildPeriodSequence('2023-07-01', '2023-07-03', 'day');
  assert.deepEqual(periods, ['2023-07-01', '2023-07-02', '2023-07-03']);
});

test('forecastEtsAuto подбирает сезонную ETS конфигурацию с минимальным sMAPE', () => {
  const series = [5, 40, 6, 42, 5, 41, 6, 43];
  const result = forecastEtsAuto(series, 2, 2, { periodLabel: 'периодов' });

  assert.equal(result.forecast.length, 2);
  assert.ok(result.modelLabel.startsWith('ETS'));
  assert.equal(result.params.seasonal, 'multiplicative');
  assert.ok(Array.isArray(result.ranking));
  assert.ok(Number.isFinite(result.metrics.smape));
});

test('buildSkuStatsForPeriods классифицирует по выбранному окну', () => {
  const skuMap = new Map([
    ['S1', new Map([['2023-01', 80]])],
    ['S2', new Map([['2023-01', 15]])],
    ['S3', new Map([['2023-01', 5]])]
  ]);

  const result = buildSkuStatsForPeriods(['2023-01'], skuMap);
  assert.equal(result.totalSku, 3);
  assert.equal(result.matrixCounts.A.X, 1);
  assert.equal(result.matrixCounts.B.X, 1);
  assert.equal(result.matrixCounts.C.X, 1);
});

test('buildSkuStatsForPeriods рассчитывает сервисный уровень и страховой запас', () => {
  const skuMap = new Map([
    ['S1', new Map([['2023-01', 10], ['2023-02', 14]])],
    ['S2', new Map([['2023-01', 2], ['2023-02', 2]])]
  ]);

  const result = buildSkuStatsForPeriods(['2023-01', '2023-02'], skuMap);
  const sku1 = result.skuStats.find(s => s.sku === 'S1');
  const sku2 = result.skuStats.find(s => s.sku === 'S2');

  assert.ok(sku1.serviceLevel > 0.89 && sku1.serviceLevel < 0.91);
  assert.ok(sku1.safetyStock > 3.5 && sku1.safetyStock < 4);
  assert.ok(sku2.serviceLevel > 0.94);
  assert.equal(result.safetyMatrix.B.Y > 0, true);
  assert.ok(result.totalSafetyStock > 3.5);
});

test('buildTransitionStats считает изменения классов по окнам', () => {
  const windowResults = [
    { key: 'w1', startPeriod: '2023-01', skuStats: [{ sku: 'S1', abc: 'A', xyz: 'X' }, { sku: 'S2', abc: 'B', xyz: 'Y' }] },
    { key: 'w2', startPeriod: '2023-02', skuStats: [{ sku: 'S1', abc: 'B', xyz: 'Y' }, { sku: 'S2', abc: 'B', xyz: 'Z' }] }
  ];

  const transitions = buildTransitionStats(windowResults);
  assert.equal(transitions.abcMatrix.A.B, 1);
  assert.equal(transitions.xyzMatrix.X.Y, 1);
  assert.equal(transitions.xyzMatrix.Y.Z, 1);
  assert.equal(transitions.skuChanges[0].sku, 'S1');
});

test('buildTransitionStats сортирует окна по дате перед расчётом', () => {
  const windowResults = [
    { key: 'later', startPeriod: '2023-02', endPeriod: '2023-02', skuStats: [{ sku: 'S1', abc: 'B', xyz: 'Z' }] },
    { key: 'earlier', startPeriod: '2023-01', endPeriod: '2023-01', skuStats: [{ sku: 'S1', abc: 'A', xyz: 'X' }] }
  ];

  const transitions = buildTransitionStats(windowResults);

  assert.equal(transitions.abcMatrix.A.B, 1);
  assert.equal(transitions.xyzMatrix.X.Z, 1);
});

test('autoTuneWindowAndHorizon ищет минимальные MAE/SMAPE в пределах ограничений', () => {
  const series = Array(10).fill(5);

  const tuned = autoTuneWindowAndHorizon(series);

  assert.ok(tuned.horizon >= 1 && tuned.horizon <= 18);
  assert.ok(tuned.windowSize >= 2 && tuned.windowSize <= 24);
  assert.equal(tuned.windowSize, 2);
  assert.equal(tuned.horizon, 1);
});

test('resolveForecastParameters использует автонастройку, если пользователь ничего не менял', () => {
  const series = [1, 2, 3, 4];
  const tuneFn = (data) => {
    assert.deepEqual(data, series);
    return { horizon: 4, windowSize: 5 };
  };

  const params = resolveForecastParameters(series, 'month', { horizonRaw: 7, windowRaw: 9 }, {}, tuneFn);

  assert.equal(params.horizon, 4);
  assert.equal(params.windowSize, 5);
  assert.equal(params.tunedUsed, true);
});

test('resolveForecastParameters сохраняет введённый пользователем горизонт', () => {
  const series = [3, 2, 1, 0];
  const tuneFn = () => ({ horizon: 2, windowSize: 4 });

  const params = resolveForecastParameters(series, 'month', { horizonRaw: 10, windowRaw: 8 }, { userAdjustedHorizon: true }, tuneFn);

  assert.equal(params.horizon, 10);
  assert.equal(params.windowSize, 4);
});

test('resolveForecastParameters отключает автонастройку, если пользователь поменял оба параметра', () => {
  const series = [5, 5, 5];
  const tuneFn = () => {
    throw new Error('tuning should be skipped');
  };

  const params = resolveForecastParameters(
    series,
    'day',
    { horizonRaw: 200, windowRaw: 100 },
    { userAdjustedHorizon: true, userAdjustedWindow: true },
    tuneFn
  );

  assert.equal(params.horizon, 120);
  assert.equal(params.windowSize, 90);
  assert.equal(params.tunedUsed, false);
});

test('selectBestForecastModel отдаёт тренд на линейных данных и считает метрики', () => {
  const series = [5, 7, 9, 11, 13, 15, 17, 19];
  const horizon = 2;

  const selection = selectBestForecastModel(series, horizon, 3);

  assert.equal(selection.bestKey, 'trend');
  assert.ok(selection.metrics.mae < 1);
  assert.ok(selection.metrics.smape < 10);
  assert.ok(Array.isArray(selection.ranking));
  assert.ok(selection.ranking.length >= 4);
  for (let i = 1; i < selection.ranking.length; i++) {
    assert.ok(selection.ranking[i - 1].score <= selection.ranking[i].score);
  }
});

test('selectBestForecastModel не падает, если одна из моделей выбрасывает исключение', () => {
  const series = [5, 6, 7, 8, 9, 10];
  const horizon = 2;
  const models = [
    {
      key: 'ok',
      label: 'Рабочая',
      runner: (data, h) => ({ forecast: Array.from({ length: h }, () => data[data.length - 1]) })
    },
    {
      key: 'fail',
      label: 'Падает',
      runner: () => {
        throw new Error('runner failed');
      }
    }
  ];

  const selection = selectBestForecastModel(series, horizon, 3, { models });

  assert.equal(selection.bestKey, 'ok');
  assert.ok(isFinite(selection.metrics.mae));
  const failed = selection.ranking.find(item => item.key === 'fail');
  assert.ok(failed);
  assert.equal(failed.status, 'Ошибка: runner failed');
});

test('autoArima подбирает параметры и возвращает метрики AIC/MAE', () => {
  const series = [12, 14, 16, 15, 18, 20, 22, 25, 24, 27, 29, 30];
  const result = autoArima(series, 3, 4);

  assert.ok(Array.isArray(result.forecast));
  assert.equal(result.forecast.length, 3);
  assert.ok(result.params && typeof result.params === 'object');
  ['p', 'd', 'q', 'P', 'D', 'Q'].forEach(key => {
    assert.ok(Object.prototype.hasOwnProperty.call(result.params, key));
  });
  assert.ok(result.metrics && isFinite(result.metrics.mae));
  assert.ok(result.metrics && isFinite(result.metrics.aic));
});

test('runArimaModel не разгоняет прогноз на стационарном ряде', () => {
  const series = [100, 102, 101, 103, 102, 101, 102];
  const result = runArimaModel(series, 5, { p: 1, d: 1, q: 1, P: 0, D: 0, Q: 0 }, 6);

  assert.ok(Array.isArray(result.forecast));
  assert.equal(result.forecast.length, 5);
  const maxForecast = Math.max(...result.forecast);
  const minForecast = Math.min(...result.forecast);
  assert.ok(maxForecast < 120);
  assert.ok(minForecast > 80);
});

test('computeAic выдаёт Infinity при пустых резидуалах', () => {
  assert.equal(computeAic([], 2), Infinity);
});

test('intermittentShare считает долю нулевых периодов', () => {
  const share = intermittentShare([0, 0, 5, 0, 2, 0, 0, 1]);
  assert.ok(Math.abs(share - 0.625) < 1e-6);
  assert.equal(intermittentShare([]), 0);
});

test('Croston/SBA/TSB формируют положительный прогноз на разреженных данных', () => {
  const series = [0, 12, 0, 0, 9, 0, 0, 11];
  const horizon = 3;

  const croston = forecastCroston(series, horizon, { alpha: 0.2 });
  const sba = forecastSba(series, horizon, { alpha: 0.2 });
  const tsb = forecastTsb(series, horizon, { alpha: 0.2, beta: 0.3 });

  [croston, sba, tsb].forEach(result => {
    assert.ok(Array.isArray(result.forecast));
    assert.equal(result.forecast.length, horizon);
    result.forecast.forEach(v => assert.ok(v >= 0));
  });

  const avgCroston = croston.forecast.reduce((a, b) => a + b, 0) / horizon;
  const avgSba = sba.forecast.reduce((a, b) => a + b, 0) / horizon;
  assert.ok(avgSba < avgCroston); // SBA корректирует вниз
});

test('selectBestIntermittentModel подбирает лучшую модификацию по backtesting', () => {
  const series = [0, 0, 5, 0, 6, 0, 0, 4, 0, 7, 0, 0, 5];
  const horizon = 2;

  const selection = selectBestIntermittentModel(series, horizon, { alpha: 0.2, beta: 0.2, periodLabel: 'периода' });

  assert.ok(selection.bestResult && Array.isArray(selection.bestResult.forecast));
  assert.equal(selection.bestResult.forecast.length, horizon);
  assert.ok(selection.metrics && isFinite(selection.metrics.mae));
  assert.ok(Array.isArray(selection.ranking));
  for (let i = 1; i < selection.ranking.length; i++) {
    assert.ok(selection.ranking[i - 1].score <= selection.ranking[i].score);
  }
  assert.ok(selection.bestResult.message.includes('backtesting'));
});

test('buildForecastTableExportData добавляет детали автоподбора модели', () => {
  const rows = [
    { period: '2023-01', actual: 10, forecast: 11 },
    { period: '2023-02', actual: 12, forecast: 12 }
  ];
  const summary = {
    modelLabel: 'Линейный тренд',
    message: 'Автовыбор',
    metrics: { mae: 0.5, smape: 4.2 },
    ranking: [
      { label: 'Линейный тренд', metrics: { mae: 0.5, smape: 4.2 } },
      { label: 'Скользящее среднее', metrics: { mae: 2.1, smape: 15 } }
    ]
  };

  const data = buildForecastTableExportData(rows, summary);

  const metaStartIndex = data.findIndex(row => Array.isArray(row) && row[0] === 'Модель');
  assert.ok(metaStartIndex > 0);
  assert.equal(data[metaStartIndex][1], 'Линейный тренд');
  assert.ok(data.some(row => Array.isArray(row) && String(row[0]).includes('Ранг 1')));
  assert.ok(data.some(row => Array.isArray(row) && String(row[1]).includes('Скользящее')));
});

test('buildAutoSelectionRows форматирует метрики и отмечает лучший вариант', () => {
  const ranking = [
    { key: 'trend', label: 'Линейный тренд', metrics: { mae: 1.2345, smape: 6.789 } },
    { key: 'ma', label: 'Скользящее среднее', metrics: { mae: 2.5 } },
    { key: 'broken', label: 'Сломанная модель', metrics: {} }
  ];

  const rows = buildAutoSelectionRows(ranking, 'trend');

  assert.equal(rows.length, 3);
  assert.ok(rows[0].isBest);
  assert.equal(rows[0].maeText, '1.235');
  assert.equal(rows[0].smapeText, '6.79%');
  assert.equal(rows[1].smapeText, '—');
  assert.equal(rows[1].status, '');
  assert.equal(rows[2].status.includes('ошибка'), true);
});

test('createOnboardingState двигается по шагам и сбрасывается', () => {
  const steps = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
  const state = createOnboardingState(steps);

  assert.equal(state.isActive(), false);
  assert.equal(state.currentStep(), null);

  state.start();
  assert.equal(state.activeIndex, 0);
  assert.deepEqual(state.currentStep(), steps[0]);

  state.next();
  assert.equal(state.activeIndex, 1);
  state.next();
  assert.equal(state.activeIndex, 2);
  state.next();
  assert.equal(state.activeIndex, 2); // не выходит за границы

  state.prev();
  assert.equal(state.activeIndex, 1);
  state.finish();
  assert.equal(state.activeIndex, -1);
  assert.equal(state.isActive(), false);
});

test('applyOnboardingLoadingState показывает оверлей и блокирует навигацию', () => {
  const overlay = { hidden: true };
  const titleEl = { textContent: '' };
  const textEl = { textContent: '' };
  const stepEl = { textContent: '' };
  const actionEl = { textContent: '' };
  const prevBtn = { disabled: false };
  const nextBtn = { disabled: false, textContent: '' };
  const bodyClasses = new Set();
  const body = { classList: { add: cls => bodyClasses.add(cls), contains: cls => bodyClasses.has(cls) } };

  applyOnboardingLoadingState({
    overlay,
    titleEl,
    textEl,
    stepEl,
    actionEl,
    prevBtn,
    nextBtn,
    body
  });

  assert.equal(overlay.hidden, false);
  assert.equal(titleEl.textContent, 'Готовим тур');
  assert.equal(stepEl.textContent, 'Подготовка тура');
  assert.equal(prevBtn.disabled, true);
  assert.equal(nextBtn.disabled, true);
  assert.equal(nextBtn.textContent, 'Загружаю…');
  assert.equal(bodyClasses.has('onboarding-open'), true);
});
