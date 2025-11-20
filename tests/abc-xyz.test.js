const test = require('node:test');
const assert = require('node:assert/strict');
const { applyViewState, collectSkuOptions, parseDateCell, formatDateCell, buildTourStepsFromElements } = require('../js/abc-xyz');

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

test('buildTourStepsFromElements orders steps and ignores invalid nodes', () => {
  const stubEl = (step, title, body) => ({
    getAttribute: (key) => {
      if (key === 'data-tour-step') return step;
      if (key === 'data-tour-title') return title;
      if (key === 'data-tour-body') return body;
      return null;
    }
  });

  const steps = buildTourStepsFromElements([
    stubEl('3', 'Третий', 'Описание 3'),
    stubEl('not-a-step', 'Некорректный', 'Нужно пропустить'),
    stubEl('1', 'Первый', 'Описание 1')
  ]);

  assert.equal(steps.length, 2);
  assert.equal(steps[0].title, 'Первый');
  assert.equal(steps[1].step, 3);
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
