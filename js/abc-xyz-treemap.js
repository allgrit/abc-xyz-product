(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.ABCXYZTreemap = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const VARIATION_SCALE = { X: 0, Y: 0.5, Z: 1 };
  const VARIATION_RANGE = { start: '#34d399', end: '#c2410c' };
  const XYZ_GRADIENTS = {
    X: { start: '#34d399', end: '#15803d' },
    Y: { start: '#facc15', end: '#d97706' },
    Z: { start: '#fb923c', end: '#c2410c' }
  };

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
      nodeIndex: indexNodes(tree),
      history: [],
      future: [],
      selectedNodeId: null,
      layoutMap: new Map()
    };
    stateStore.set(el, state);
    if (typeof el.addEventListener === 'function' && !el.__treemapListenerAttached) {
      el.addEventListener('click', handleTreemapClick);
      el.addEventListener('keydown', handleTreemapKeyNav);
      if (typeof el.setAttribute === 'function') {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'group');
      }
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
    state.layoutMap = new Map();
    layout.forEach(cell => state.layoutMap.set(cell.node.id, cell));
    const breadcrumb = buildBreadcrumb(path);
    const cells = layout.map(cell => renderCell(cell, current.value)).join('');
    const overlay = renderTreemapOverlay(state);
    el.innerHTML =
      '<div class="treemap-shell">' +
        '<div class="treemap-header">' +
          `<button class="treemap-back" data-treemap-action="back" ${current.parent ? '' : 'disabled'}>Назад</button>` +
          `<div class="treemap-path" role="navigation" aria-label="Навигация по уровням">${breadcrumb}</div>` +
        '</div>' +
        '<div class="treemap-surface" role="list">' +
          cells +
          overlay +
        '</div>' +
      '</div>';
  }

  function buildTreemapExportSvg(el, { width = 960, height = 540, title = 'Treemap ABC/XYZ' } = {}) {
    const state = stateStore.get(el);
    if (!state) return null;
    const current = state.current;
    const path = collectPath(current);
    const depth = Math.max(0, path.length - 1);
    const layout = computeTreemapLayout(current.children || [], depth);
    if (!layout.length) return null;

    const defs = [];
    const cells = layout.map((cell, idx) => {
      const node = cell.node;
      const share = current.value > 0 ? (node.value / current.value) * 100 : 0;
      const shareText = share >= 10 ? share.toFixed(1) : share.toFixed(2);
      const valueText = formatValue(node.value);
      const gradient = pickGradient(node);
      const gradientStops = extractGradientStops(gradient);
      let fill = gradient || '#0f172a';
      if (gradientStops) {
        const gradId = `grad-${idx}`;
        defs.push(
          `<linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">` +
            `<stop offset="0%" stop-color="${gradientStops.start}" />` +
            `<stop offset="100%" stop-color="${gradientStops.end}" />` +
          '</linearGradient>'
        );
        fill = `url(#${gradId})`;
      }
      const x = (cell.left / 100) * width;
      const y = (cell.top / 100) * height;
      const w = (cell.width / 100) * width;
      const h = (cell.height / 100) * height;
      const label = escapeHtml(node.label);
      const badge = node.abc ? `${node.abc}${node.xyz || ''}` : '';
      return (
        `<g data-node-id="${escapeHtml(node.id)}">` +
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ry="8" fill="${fill}" stroke="#0f172a" stroke-width="1.5"/>` +
          `<text x="${x + 8}" y="${y + 18}" font-size="12" font-weight="700" fill="#e5e7eb">${label}${badge ? ` • ${badge}` : ''}</text>` +
          `<text x="${x + 8}" y="${y + 34}" font-size="11" fill="#e5e7eb">${valueText} • ${shareText}%</text>` +
        '</g>'
      );
    }).join('');

    const subtitle = escapeHtml(path.map(node => node.label).join(' / '));
    const defsBlock = defs.length ? `<defs>${defs.join('')}</defs>` : '';
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Treemap ABC/XYZ">` +
        defsBlock +
        `<rect x="0" y="0" width="${width}" height="${height}" fill="#0b1220"/>` +
        `<text x="16" y="28" font-size="18" fill="#e5e7eb" font-weight="700">${escapeHtml(title)}</text>` +
        `<text x="16" y="48" font-size="12" fill="#9ca3af">${subtitle}</text>` +
        `<g>${cells}</g>` +
      '</svg>'
    );
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
    const densityClass = classifyCellDensity(cell);
    const classes = ['treemap-cell'];
    if (type === 'group') classes.push('treemap-cell--group');
    if (node.abc) classes.push(`treemap-cell-abc-${node.abc.toLowerCase()}`);
    if (densityClass) classes.push(densityClass);
    const pill = node.abc ? `<span class="treemap-pill">${node.abc}${node.xyz || ''}</span>` : '';
    const hint = type === 'group' ? '<div class="treemap-cell-hint">щёлкните, чтобы раскрыть</div>' : '';
    const label = escapeHtml(node.label);
    const ariaLabel = `${label} • ${valueText} (${shareText}% от уровня)`;
    return (
      `<div class="${classes.join(' ')}" role="listitem" data-node-id="${node.id}" data-node-type="${type}"` +
      ` data-label="${label}" aria-label="${ariaLabel}"` +
      ` style="left:${cell.left}%;top:${cell.top}%;width:${cell.width}%;height:${cell.height}%;background:${gradient};"` +
      ` title="${label} • ${valueText} (${shareText}% от уровня)">` +
        '<div class="treemap-cell-inner">' +
          `<div class="treemap-cell-title">${label} ${pill}</div>` +
          `<div class="treemap-cell-meta">${valueText} • ${shareText}%</div>` +
          hint +
        '</div>' +
      '</div>'
    );
  }

  function classifyCellDensity(cell) {
    const minSide = Math.min(cell.width, cell.height);
    if (cell.share < 1 || minSide < 3) return 'treemap-cell--micro';
    if (cell.share < 4 || minSide < 10) return 'treemap-cell--compact';
    return '';
  }

  function pickGradient(node) {
    const smoothGradient = buildVariationGradient(node.xyz);
    if (smoothGradient) return smoothGradient;
    const idx = Math.abs(hashCode(node.id)) % FALLBACK_GRADIENTS.length;
    const [from, to] = FALLBACK_GRADIENTS[idx];
    return `linear-gradient(135deg, ${from}, ${to})`;
  }

  function buildVariationGradient(xyz) {
    const presetKey = normalizeVariationKey(xyz);
    if (presetKey && XYZ_GRADIENTS[presetKey]) {
      const { start, end } = XYZ_GRADIENTS[presetKey];
      return `linear-gradient(135deg, ${start}, ${end})`;
    }

    const ratio = normalizeVariationValue(xyz);
    if (ratio === null) return null;
    const base = mixHexColors(VARIATION_RANGE.start, VARIATION_RANGE.end, ratio);
    if (!base) return null;
    const highlight = shadeHexColor(base, 0.2);
    const shadow = shadeHexColor(base, -0.25);
    return `linear-gradient(135deg, ${highlight}, ${shadow})`;
  }

  function normalizeVariationKey(xyz) {
    if (xyz === undefined || xyz === null) return null;
    if (typeof xyz === 'string') {
      const key = xyz.trim().toUpperCase();
      return key || null;
    }
    if (typeof xyz === 'number' && Number.isFinite(xyz)) {
      return String(xyz);
    }
    return null;
  }

  function normalizeVariationValue(xyz) {
    const key = normalizeVariationKey(xyz);
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
        if (navigateBack(state)) updateTreemap(el);
      } else if (action === 'forward') {
        if (navigateForward(state)) updateTreemap(el);
      } else if (action === 'crumb') {
        const idx = parseInt(actionTarget.getAttribute('data-crumb-index'), 10);
        if (!Number.isNaN(idx)) {
          const path = collectPath(state.current);
          const target = path[idx];
          if (target) {
            state.current = target;
            state.history = path.slice(0, idx);
            state.future = [];
            state.selectedNodeId = null;
            updateTreemap(el);
          }
        }
      } else if (action === 'expand') {
        const nodeId = actionTarget.getAttribute('data-node-id');
        const node = state.nodeIndex.get(nodeId);
        if (node && node.children && node.children.length) {
          navigateToNode(state, node);
          updateTreemap(el);
        }
      } else if (action === 'overlay-close') {
        state.selectedNodeId = null;
        updateTreemap(el);
      }
      return;
    }
    const cellEl = findClosest(event.target, '[data-node-id]');
    if (!cellEl) return;
    const nodeId = cellEl.getAttribute('data-node-id');
    const node = state.nodeIndex.get(nodeId);
    if (!node) return;
    state.selectedNodeId = nodeId;
    if (node && node.children && node.children.length && event.detail >= 2) {
      navigateToNode(state, node);
    }
    updateTreemap(el);
  }

  function handleTreemapKeyNav(event) {
    const el = event.currentTarget;
    const state = stateStore.get(el);
    if (!state) return;
    if (event.altKey && event.key === 'ArrowLeft') {
      if (navigateBack(state)) {
        updateTreemap(el);
        event.preventDefault();
      }
    } else if (event.altKey && event.key === 'ArrowRight') {
      if (navigateForward(state)) {
        updateTreemap(el);
        event.preventDefault();
      }
    }
  }

  function navigateToNode(state, target) {
    if (!target || state.current === target) return false;
    state.history.push(state.current);
    state.current = target;
    state.future = [];
    state.selectedNodeId = null;
    return true;
  }

  function navigateBack(state) {
    if (state.history.length) {
      const prev = state.history.pop();
      state.future.push(state.current);
      state.current = prev;
      state.selectedNodeId = null;
      return true;
    }
    if (state.current.parent) {
      state.current = state.current.parent;
      state.future = [];
      state.selectedNodeId = null;
      return true;
    }
    return false;
  }

  function navigateForward(state) {
    if (!state.future.length) return false;
    const next = state.future.pop();
    state.history.push(state.current);
    state.current = next;
    state.selectedNodeId = null;
    return true;
  }

  function renderTreemapOverlay(state) {
    const nodeId = state.selectedNodeId;
    if (!nodeId || !state.layoutMap.has(nodeId)) {
      return '<div class="treemap-overlay treemap-overlay--hidden"></div>';
    }
    const meta = state.layoutMap.get(nodeId);
    const node = state.nodeIndex.get(nodeId);
    if (!node) return '<div class="treemap-overlay treemap-overlay--hidden"></div>';
    const shareText = meta.share >= 10 ? `${meta.share.toFixed(1)}%` : `${meta.share.toFixed(2)}%`;
    const valueText = formatValue(node.value);
    const badge = node.abc ? `<span class="treemap-pill">${node.abc}${node.xyz || ''}</span>` : '';
    const expandBtn = node.children && node.children.length
      ? `<button class="treemap-overlay-action" data-treemap-action="expand" data-node-id="${escapeHtml(node.id)}">Развернуть</button>`
      : '';
    const navButtons = '<div class="treemap-overlay-nav">' +
      `<button data-treemap-action="back" title="Назад">‹</button>` +
      `<button data-treemap-action="forward" title="Вперёд">›</button>` +
      '</div>';
    return (
      `<div class="treemap-overlay" style="left:${meta.left}%;top:${meta.top}%;width:${meta.width}%;height:${meta.height}%">` +
        '<div class="treemap-overlay-head">' +
          `<div class="treemap-overlay-title">${escapeHtml(node.label)} ${badge}</div>` +
          '<div class="treemap-overlay-controls">' +
            navButtons +
            `<button class="treemap-overlay-action" data-treemap-action="overlay-close" title="Закрыть">✕</button>` +
          '</div>' +
        '</div>' +
        `<div class="treemap-overlay-meta">${valueText} • ${shareText}${node.children && node.children.length ? ` • вложенных: ${node.children.length}` : ''}</div>` +
        (node.sku ? `<div class="treemap-overlay-sku">SKU: ${escapeHtml(node.sku)}</div>` : '') +
        (node.xyz ? `<div class="treemap-overlay-xyz">Вариация: ${escapeHtml(node.xyz)}</div>` : '') +
        (node.isGroup ? '<div class="treemap-overlay-hint">Группа объединяет малые SKU</div>' : '') +
        (expandBtn ? `<div class="treemap-overlay-actions">${expandBtn}</div>` : '') +
      '</div>'
    );
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

  function extractGradientStops(gradient) {
    if (typeof gradient !== 'string') return null;
    const match = gradient.match(/linear-gradient\([^,]+,\s*([^,]+),\s*([^\)]+)\)/i);
    if (!match) return null;
    return { start: match[1].trim(), end: match[2].trim() };
  }

  return {
    renderTreemap,
    computeTreemapLayout,
    buildTreemapHierarchy,
    buildTreemapExportSvg
  };
});
