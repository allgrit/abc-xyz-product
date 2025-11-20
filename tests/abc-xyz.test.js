const test = require('node:test');
const assert = require('node:assert/strict');
const { applyViewState, collectSkuOptions, parseDateCell, formatDateCell, buildMatrixExportData, buildSkuExportData } = require('../js/abc-xyz');

function makeStubEl(viewName) {
  const classes = new Set();
  return {
    hidden: false,
    attributes: { 'data-view': viewName },
    classList: {
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

test('buildSkuExportData добавляет проценты и CoV', () => {
  const data = buildSkuExportData([
    { sku: 'A-1', total: 10, abc: 'A', xyz: 'X', cov: 0.12, share: 0.5, cumShare: 0.5 },
    { sku: 'B-2', total: 4, abc: 'B', xyz: 'Y', cov: null, share: 0.2, cumShare: 0.7 }
  ]);

  assert.equal(data[0][0], 'SKU');
  assert.equal(data[1][5], 50); // share в процентах
  assert.equal(data[2][4], null); // пустой cov превращается в null
  assert.equal(data.length, 3);
});
