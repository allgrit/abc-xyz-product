const test = require('node:test');
const assert = require('node:assert/strict');
const { computeTreemapLayout, renderTreemap, normalizeCounts } = require('../js/abc-xyz-treemap');

test('normalizeCounts coerces invalid values to zero', () => {
  const normalized = normalizeCounts({
    A: { X: '5', Y: null, Z: -3 },
    B: { X: undefined, Y: 2, Z: 'not-a-number' }
  });
  assert.deepEqual(normalized, {
    A: { X: 5, Y: 0, Z: 0 },
    B: { X: 0, Y: 2, Z: 0 },
    C: { X: 0, Y: 0, Z: 0 }
  });
});

test('computeTreemapLayout calculates row/cell shares', () => {
  const layout = computeTreemapLayout({
    A: { X: 3, Y: 1, Z: 0 },
    B: { X: 0, Y: 2, Z: 0 },
    C: { X: 0, Y: 0, Z: 4 }
  });

  assert.equal(layout.total, 10);
  assert.equal(layout.rows.length, 3);

  const rowA = layout.rows[0];
  assert.equal(rowA.label, 'A');
  assert.ok(Math.abs(rowA.share - 40) < 1e-9);
  const cellAX = rowA.cells.find(cell => cell.label === 'AX');
  assert.ok(cellAX);
  assert.ok(Math.abs(cellAX.width - 75) < 1e-9);
  assert.ok(Math.abs(cellAX.shareOfTotal - 30) < 1e-9);

  const rowC = layout.rows.find(row => row.label === 'C');
  assert.ok(rowC.cells.length === 1);
  assert.equal(rowC.cells[0].label, 'CZ');
  assert.ok(Math.abs(rowC.top - 60) < 1e-9);
});

test('renderTreemap falls back to placeholder when there is no data', () => {
  const el = { innerHTML: '' };
  renderTreemap(el, {});
  assert.match(el.innerHTML, /Нет данных для визуализации/);
});

test('renderTreemap renders markup for non-empty data', () => {
  const el = { innerHTML: '' };
  renderTreemap(el, {
    A: { X: 2, Y: 1, Z: 1 },
    B: { X: 0, Y: 0, Z: 1 }
  });

  assert.match(el.innerHTML, /AX: 2 SKU/);
  assert.match(el.innerHTML, /A — 80\.0%/);
  assert.match(el.innerHTML, /class=\"treemap-cell-label\"/);
});
