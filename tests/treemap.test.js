const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTreemapHierarchy, computeTreemapLayout, renderTreemap, buildTreemapExportSvg } = require('../js/abc-xyz-treemap');

test('buildTreemapHierarchy groups малозначимые SKU в блок "Прочие"', () => {
  const tree = buildTreemapHierarchy([
    { sku: 'SKU-1', total: 120 },
    { sku: 'SKU-2', total: 80 },
    { sku: 'SKU-3', total: 8 },
    { sku: 'SKU-4', total: 6 },
    { sku: 'SKU-5', total: 5 }
  ], { significanceShare: 0.2, minVisible: 1, maxVisible: 3 });

  assert.ok(tree);
  assert.equal(tree.label, 'Все SKU');
  assert.ok(tree.children.length >= 2);
  const otherNode = tree.children.find(child => child.isGroup);
  assert.ok(otherNode);
  assert.match(otherNode.label, /Прочие/);
  assert.ok(otherNode.children.length >= 1);
});

test('computeTreemapLayout формирует плитку, а не одну линию', () => {
  const nodes = [
    { id: 'a', value: 60, label: 'A', children: [] },
    { id: 'b', value: 25, label: 'B', children: [] },
    { id: 'c', value: 15, label: 'C', children: [] }
  ];

  const layout = computeTreemapLayout(nodes, 0);
  assert.equal(layout.length, 3);
  const totalArea = layout.reduce((sum, cell) => sum + (cell.width * cell.height), 0);
  assert.ok(Math.abs(totalArea - 10000) < 1);
  const hasRowSplit = layout.some(cell => cell.top > 0 && cell.height < 100);
  const hasColumnSplit = layout.some(cell => cell.left > 0 && cell.width < 100);
  assert.ok(hasRowSplit, 'должно быть горизонтальное деление прямоугольников');
  assert.ok(hasColumnSplit, 'должно быть вертикальное деление прямоугольников');
  const mainCell = layout.find(cell => cell.node.id === 'a');
  assert.ok(mainCell);
  assert.ok(Math.abs(mainCell.share - 60) < 1e-9);
});

test('renderTreemap выводит заглушку без данных', () => {
  const el = { innerHTML: '' };
  renderTreemap(el, []);
  assert.match(el.innerHTML, /Нет данных для визуализации/);
});

test('renderTreemap строит ячейки по SKU и подсказки для групп', () => {
  const el = { innerHTML: '', addEventListener: () => {} };
  renderTreemap(el, [
    { sku: 'A-01', total: 120, abc: 'A', xyz: 'X' },
    { sku: 'B-02', total: 90, abc: 'B', xyz: 'Y' },
    { sku: 'C-03', total: 5, abc: 'C', xyz: 'Z' }
  ], { significanceShare: 0.15, minVisible: 1 });

  assert.match(el.innerHTML, /A-01/);
  assert.match(el.innerHTML, /data-node-id/);
  assert.match(el.innerHTML, /щёлкните, чтобы раскрыть/);
});

test('renderTreemap помечает плотные плитки классами compact/micro и отдаёт подписи', () => {
  const el = { innerHTML: '', addEventListener: () => {} };
  renderTreemap(el, [
    { sku: 'LARGE', total: 1000, abc: 'A', xyz: 'X' },
    { sku: 'MEDIUM', total: 30, abc: 'B', xyz: 'Y' },
    { sku: 'SMALL-1', total: 6 },
    { sku: 'SMALL-2', total: 5 }
  ], { significanceShare: 0.001, minVisible: 4, maxVisible: 10 });

  assert.match(el.innerHTML, /treemap-cell--compact/);
  assert.match(el.innerHTML, /treemap-cell--micro/);
  assert.match(el.innerHTML, /data-label="SMALL-1"/);
  assert.match(el.innerHTML, /aria-label="SMALL-1 •/);
});

test('buildTreemapExportSvg возвращает SVG со строками и градиентом', () => {
  const el = { innerHTML: '', addEventListener: () => {} };
  renderTreemap(el, [
    { sku: 'A-01', total: 120, abc: 'A', xyz: 'X' },
    { sku: 'B-02', total: 90, abc: 'B', xyz: 'Y' }
  ], { significanceShare: 0.15, minVisible: 1 });

  const svg = buildTreemapExportSvg(el, { width: 400, height: 200, title: 'Snapshot' });
  assert.match(svg, /<svg/);
  assert.match(svg, /Snapshot/);
  assert.match(svg, /linearGradient/);
});

test('buildTreemapExportSvg использует читабельную палитру XYZ', () => {
  const el = { innerHTML: '', addEventListener: () => {} };
  renderTreemap(el, [
    { sku: 'A-01', total: 100, abc: 'A', xyz: 'X' },
    { sku: 'B-02', total: 80, abc: 'B', xyz: 'Y' },
    { sku: 'C-03', total: 60, abc: 'C', xyz: 'Z' }
  ], { significanceShare: 0.1, minVisible: 1 });

  const svg = buildTreemapExportSvg(el, { width: 320, height: 180, title: 'Palette' });
  assert.match(svg, /#34d399/i);
  assert.match(svg, /#d97706/i);
  assert.match(svg, /#c2410c/i);
});
