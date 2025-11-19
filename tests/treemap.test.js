const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTreemapHierarchy, computeTreemapLayout, renderTreemap } = require('../js/abc-xyz-treemap');

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

test('computeTreemapLayout меняет ориентацию в зависимости от глубины', () => {
  const nodes = [
    { id: 'a', value: 60, label: 'A', children: [] },
    { id: 'b', value: 40, label: 'B', children: [] }
  ];

  const horizontal = computeTreemapLayout(nodes, 0);
  assert.equal(horizontal[0].width, 60);
  assert.equal(horizontal[0].height, 100);

  const vertical = computeTreemapLayout(nodes, 1);
  assert.equal(vertical[0].width, 100);
  assert.equal(vertical[0].height, 60);
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
