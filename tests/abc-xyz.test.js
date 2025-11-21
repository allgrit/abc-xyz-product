const test = require('node:test');
const assert = require('node:assert/strict');
const { applyViewState, collectSkuOptions, parseDateCell, formatDateCell, buildMatrixExportData, buildSkuExportData, parseWindowSizes, buildPeriodSequence, buildSkuStatsForPeriods, buildTransitionStats, createOnboardingState, applyOnboardingLoadingState } = require('../js/abc-xyz');

function makeStubEl(viewName) {
  const classes = new Set();
  return {
    hidden: false,
    attributes: { 'data-view': viewName },
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
    }
  };
}

test('applyViewState hides inactive view and updates accessibility attrs', () => {
  const sectionAnalysis = makeStubEl('analysis');
  const sectionForecast = makeStubEl('forecast');
  const tabAnalysis = makeStubEl('analysis');
  const tabForecast = makeStubEl('forecast');

  applyViewState([sectionAnalysis, sectionForecast], [tabAnalysis, tabForecast], 'forecast');

  assert.equal(sectionAnalysis.hidden, true);
  assert.equal(sectionForecast.hidden, false);
  assert.equal(sectionAnalysis.attributes['aria-hidden'], 'true');
  assert.equal(sectionForecast.attributes['aria-hidden'], 'false');
  assert.ok(tabForecast.classList.contains('active'));
  assert.equal(tabForecast.attributes['aria-selected'], 'true');
  assert.equal(tabForecast.attributes.tabindex, '0');
  assert.equal(tabAnalysis.attributes.tabindex, '-1');
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
  assert.equal(data[0].length, 9);
  assert.equal(data[1][5], 2.3);
  assert.equal(data[1][6], 95);
  assert.equal(data[1][7], 50); // share в процентах
  assert.equal(data[2][4], null); // пустой cov превращается в null
  assert.equal(data.length, 3);
});

test('parseWindowSizes нормализует список окон', () => {
  assert.deepEqual(parseWindowSizes('6, 3; 6 9'), [3, 6, 9]);
  assert.deepEqual(parseWindowSizes(['2', '4', '4']), [2, 4]);
});

test('buildPeriodSequence перечисляет месяцы в диапазоне', () => {
  const periods = buildPeriodSequence('2023-01', '2023-03');
  assert.deepEqual(periods, ['2023-01', '2023-02', '2023-03']);
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
