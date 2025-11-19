(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.ABCXYZTreemap = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const VARIATION_SCALE = { X: 0, Y: 0.5, Z: 1 };
  const VARIATION_RANGE = { start: '#22c55e', end: '#a855f7' };

  const FALLBACK_GRADIENTS = [
    ['#0f172a', '#1f2937'],
    ['#0c4a6e', '#0284c7'],
    ['#312e81', '#6366f1'],
    ['#3b0764', '#c026d3'],
    ['#064e3b', '#10b981']
  ];

  const DEFAULT_OPTIONS = {
    significanceShare: 0.02,
    minVisible: 6,
    maxVisible: 24
  };

  const stateStore = typeof WeakMap !== 'undefined' ? new WeakMap() : new Map();
  const numberFormatter = (typeof Intl !== 'undefined' && Intl.NumberFormat)
    ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
    : null;
  let groupCounter = 0;

  function sanitizeStats(stats = []) {
    if (!Array.isArray(stats)) return [];
    const sanitized = [];
    let idx = 0;
    stats.forEach(item => {
      if (!item) return;
      const total = Number(item.total);
      if (!Number.isFinite(total) || total <= 0) return;
      const skuRaw = item.sku === undefined || item.sku === null ? '' : String(item.sku).trim();
      if (!skuRaw) return;
      sanitized.push({
        id: `sku-${idx++}`,
        sku: skuRaw,
        label: skuRaw,
        value: total,
        abc: item.abc || '',
        xyz: item.xyz || ''
      });
    });
    sanitized.sort((a, b) => b.value - a.value);
    return sanitized;
  }

  function buildTreemapHierarchy(stats, options = {}) {
    const items = sanitizeStats(stats);
    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (!total) {
      return null;
    }
    groupCounter = 0;
    const children = partitionItems(items, { ...DEFAULT_OPTIONS, ...options }, 0);
    const root = {
      id: 'root',
      label: 'Все SKU',
      value: total,
      children
    };
    assignParents(root, null);
    return root;
  }

  function partitionItems(items, options, depth) {
    if (!items.length) return [];
    const { significanceShare, minVisible, maxVisible } = options;
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const visible = [];
    const remainder = [];
    items.forEach((item, idx) => {
      const share = total > 0 ? item.value / total : 0;
      if (share >= significanceShare || idx < minVisible) {
        visible.push(item);
      } else {
        remainder.push(item);
      }
    });
    if (visible.length > maxVisible) {
      const overflow = visible.splice(maxVisible);
      remainder.unshift(...overflow);
    }

    const nodes = visible.map(item => ({
      id: `${item.id}-d${depth}`,
      label: item.label,
      sku: item.sku,
      value: item.value,
      abc: item.abc,
      xyz: item.xyz,
      children: []
    }));

    if (remainder.length) {
      const groupValue = remainder.reduce((sum, item) => sum + item.value, 0);
      const groupNode = {
        id: `group-${groupCounter++}-d${depth}`,
        label: `Прочие (${remainder.length})`,
        value: groupValue,
        children: partitionItems(remainder, options, depth + 1),
        isGroup: true
      };
      nodes.push(groupNode);
    }

    return nodes;
  }

  function assignParents(node, parent) {
    node.parent = parent || null;
    if (Array.isArray(node.children)) {
      node.children.forEach(child => assignParents(child, node));
    }
  }

  function computeTreemapLayout(nodes = [], depth = 0) {
    if (!Array.isArray(nodes) || !nodes.length) return [];
    const prepared = nodes
      .map(node => ({ node, value: Math.max(Number(node.value) || 0, 0) }))
      .filter(item => item.value > 0);
    if (!prepared.length) return [];
    const total = prepared.reduce((sum, item) => sum + item.value, 0);
    if (!total) return [];
    const baseRect = { x: 0, y: 0, width: 100, height: 100 };
    const items = prepared.sort((a, b) => b.value - a.value);
    const cells = [];
    const initialHorizontal = depth % 2 === 0;
    layoutBinaryTreemap(items, baseRect, initialHorizontal, cells);
    return cells.map(cell => ({
      node: cell.node,
      left: clampPercent(cell.x),
      top: clampPercent(cell.y),
      width: clampPercent(cell.width),
      height: clampPercent(cell.height),
      share: total ? (cell.value / total) * 100 : 0
    }));
  }

  function layoutBinaryTreemap(items, rect, horizontal, output) {
    if (!items.length || rect.width <= 0 || rect.height <= 0) return;
    if (items.length === 1) {
      const item = items[0];
      output.push({
        node: item.node,
        value: item.value,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      });
      return;
    }
    const totalValue = items.reduce((sum, item) => sum + item.value, 0);
    if (totalValue <= 0) return;
    const half = totalValue / 2;
    let splitIndex = 0;
    let acc = 0;
    for (let i = 0; i < items.length; i++) {
      acc += items[i].value;
      if (acc >= half) {
        splitIndex = i + 1;
        break;
      }
    }
    if (splitIndex <= 0 || splitIndex >= items.length) {
      splitIndex = Math.ceil(items.length / 2);
      acc = items.slice(0, splitIndex).reduce((sum, item) => sum + item.value, 0);
    }
    const first = items.slice(0, splitIndex);
    const second = items.slice(splitIndex);
    const firstShare = acc / totalValue;
    if (horizontal) {
      const firstWidth = rect.width * firstShare;
      const rectA = { x: rect.x, y: rect.y, width: firstWidth, height: rect.height };
      const rectB = {
        x: rect.x + firstWidth,
        y: rect.y,
        width: Math.max(0, rect.width - firstWidth),
        height: rect.height
      };
      layoutBinaryTreemap(first, rectA, !horizontal, output);
      layoutBinaryTreemap(second, rectB, !horizontal, output);
    } else {
      const firstHeight = rect.height * firstShare;
      const rectA = { x: rect.x, y: rect.y, width: rect.width, height: firstHeight };
      const rectB = {
        x: rect.x,
        y: rect.y + firstHeight,
        width: rect.width,
        height: Math.max(0, rect.height - firstHeight)
      };
      layoutBinaryTreemap(first, rectA, !horizontal, output);
      layoutBinaryTreemap(second, rectB, !horizontal, output);
    }
  }

  function renderTreemap(el, stats, options = {}) {
    if (!el) return;
    const tree = buildTreemapHierarchy(stats, options);
    if (!tree || !tree.children.length) {
      el.innerHTML = '<div class="treemap-empty">Нет данных для визуализации.</div>';
      stateStore.delete(el);
      return;
    }
    const state = {
      root: tree,
      current: tree,
      options: { ...DEFAULT_OPTIONS, ...options },
      nodeIndex: indexNodes(tree)
    };
    stateStore.set(el, state);
    if (typeof el.addEventListener === 'function' && !el.__treemapListenerAttached) {
      el.addEventListener('click', handleTreemapClick);
      el.__treemapListenerAttached = true;
    }
    updateTreemap(el);
  }

  function indexNodes(root) {
    const map = new Map();
    (function walk(node) {
      map.set(node.id, node);
      if (Array.isArray(node.children)) {
        node.children.forEach(walk);
      }
    })(root);
    return map;
  }

  function updateTreemap(el) {
    const state = stateStore.get(el);
    if (!state) return;
    const current = state.current;
    const path = collectPath(current);
    const depth = Math.max(0, path.length - 1);
    const layout = computeTreemapLayout(current.children || [], depth);
    if (!layout.length) {
      el.innerHTML = '<div class="treemap-empty">Нет данных для визуализации.</div>';
      return;
    }
    const breadcrumb = buildBreadcrumb(path);
    const cells = layout.map(cell => renderCell(cell, current.value)).join('');
    el.innerHTML =
      '<div class="treemap-shell">' +
        '<div class="treemap-header">' +
          `<button class="treemap-back" data-treemap-action="back" ${current.parent ? '' : 'disabled'}>Назад</button>` +
          `<div class="treemap-path" role="navigation" aria-label="Навигация по уровням">${breadcrumb}</div>` +
        '</div>' +
        '<div class="treemap-surface" role="list">' +
          cells +
        '</div>' +
      '</div>';
  }

  function buildBreadcrumb(path) {
    return path.map((node, idx) => {
      const isLast = idx === path.length - 1;
      const attrs = `data-treemap-action="crumb" data-crumb-index="${idx}"`;
      return `<button class="treemap-crumb ${isLast ? 'active' : ''}" ${attrs} ${isLast ? 'disabled' : ''}>${escapeHtml(node.label)}</button>`;
    }).join('<span class="treemap-crumb-sep">›</span>');
  }

  function renderCell(cell, parentValue) {
    const node = cell.node;
    const share = parentValue > 0 ? (node.value / parentValue) * 100 : 0;
    const shareText = share >= 10 ? share.toFixed(1) : share.toFixed(2);
    const valueText = formatValue(node.value);
    const gradient = pickGradient(node);
    const type = node.children && node.children.length ? 'group' : 'leaf';
    const classes = ['treemap-cell'];
    if (type === 'group') classes.push('treemap-cell--group');
    if (node.abc) classes.push(`treemap-cell-abc-${node.abc.toLowerCase()}`);
    const pill = node.abc ? `<span class="treemap-pill">${node.abc}${node.xyz || ''}</span>` : '';
    const hint = type === 'group' ? '<div class="treemap-cell-hint">щёлкните, чтобы раскрыть</div>' : '';
    return (
      `<div class="${classes.join(' ')}" role="listitem" data-node-id="${node.id}" data-node-type="${type}"` +
      ` style="left:${cell.left}%;top:${cell.top}%;width:${cell.width}%;height:${cell.height}%;background:${gradient};"` +
      ` title="${escapeHtml(node.label)} • ${valueText} (${shareText}% от уровня)">` +
        '<div class="treemap-cell-inner">' +
          `<div class="treemap-cell-title">${escapeHtml(node.label)} ${pill}</div>` +
          `<div class="treemap-cell-meta">${valueText} • ${shareText}%</div>` +
          hint +
        '</div>' +
      '</div>'
    );
  }

  function pickGradient(node) {
    const smoothGradient = buildVariationGradient(node.xyz);
    if (smoothGradient) return smoothGradient;
    const idx = Math.abs(hashCode(node.id)) % FALLBACK_GRADIENTS.length;
    const [from, to] = FALLBACK_GRADIENTS[idx];
    return `linear-gradient(135deg, ${from}, ${to})`;
  }

  function buildVariationGradient(xyz) {
    const ratio = normalizeVariationValue(xyz);
    if (ratio === null) return null;
    const base = mixHexColors(VARIATION_RANGE.start, VARIATION_RANGE.end, ratio);
    if (!base) return null;
    const highlight = shadeHexColor(base, 0.2);
    const shadow = shadeHexColor(base, -0.25);
    return `linear-gradient(135deg, ${highlight}, ${shadow})`;
  }

  function normalizeVariationValue(xyz) {
    if (xyz === undefined || xyz === null) return null;
    const key = String(xyz).trim().toUpperCase();
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(VARIATION_SCALE, key)) {
      return VARIATION_SCALE[key];
    }
    const numeric = Number(key);
    if (Number.isFinite(numeric)) {
      return Math.min(1, Math.max(0, numeric));
    }
    return null;
  }

  function shadeHexColor(hex, amount) {
    const target = amount >= 0 ? '#ffffff' : '#000000';
    return mixHexColors(hex, target, Math.min(1, Math.max(0, Math.abs(amount)))) || hex;
  }

  function mixHexColors(from, to, ratio) {
    const start = hexToRgb(from);
    const end = hexToRgb(to);
    if (!start || !end) return null;
    const t = Math.min(1, Math.max(0, ratio));
    const r = Math.round(start.r + (end.r - start.r) * t);
    const g = Math.round(start.g + (end.g - start.g) * t);
    const b = Math.round(start.b + (end.b - start.b) * t);
    return rgbToHex(r, g, b);
  }

  function hexToRgb(hex) {
    if (!hex) return null;
    let normalized = String(hex).trim().replace(/^#/, '');
    if (normalized.length === 3) {
      normalized = normalized.split('').map(ch => ch + ch).join('');
    }
    if (normalized.length !== 6 || /[^0-9a-f]/i.test(normalized)) {
      return null;
    }
    const intVal = parseInt(normalized, 16);
    return {
      r: (intVal >> 16) & 255,
      g: (intVal >> 8) & 255,
      b: intVal & 255
    };
  }

  function rgbToHex(r, g, b) {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function toHex(value) {
    const clamped = Math.min(255, Math.max(0, Math.round(value)));
    return clamped.toString(16).padStart(2, '0');
  }

  function formatValue(value) {
    const rounded = Math.round(value);
    if (numberFormatter) {
      return numberFormatter.format(rounded);
    }
    return String(rounded);
  }

  function collectPath(node) {
    const path = [];
    let current = node;
    while (current) {
      path.unshift(current);
      current = current.parent;
    }
    return path;
  }

  function handleTreemapClick(event) {
    const el = event.currentTarget;
    const state = stateStore.get(el);
    if (!state) return;
    const actionTarget = findClosest(event.target, '[data-treemap-action]');
    if (actionTarget) {
      const action = actionTarget.getAttribute('data-treemap-action');
      if (action === 'back') {
        if (state.current.parent) {
          state.current = state.current.parent;
          updateTreemap(el);
        }
      } else if (action === 'crumb') {
        const idx = parseInt(actionTarget.getAttribute('data-crumb-index'), 10);
        if (!Number.isNaN(idx)) {
          const path = collectPath(state.current);
          const target = path[idx];
          if (target) {
            state.current = target;
            updateTreemap(el);
          }
        }
      }
      return;
    }
    const cellEl = findClosest(event.target, '[data-node-id]');
    if (!cellEl) return;
    const nodeId = cellEl.getAttribute('data-node-id');
    const node = state.nodeIndex.get(nodeId);
    if (node && node.children && node.children.length) {
      state.current = node;
      updateTreemap(el);
    }
  }

  function findClosest(target, selector) {
    let el = target;
    while (el && el.nodeType !== 1) {
      el = el.parentElement;
    }
    while (el) {
      if (typeof el.matches === 'function' && el.matches(selector)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => {
      switch (ch) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return ch;
      }
    });
  }

  function clampPercent(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, parseFloat(value.toFixed(4))));
  }

  return {
    renderTreemap,
    computeTreemapLayout,
    buildTreemapHierarchy
  };
});
