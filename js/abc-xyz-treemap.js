(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.ABCXYZTreemap = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const XYZ_COLORS = {
    X: ['#134e4a', '#22c55e'],
    Y: ['#78350f', '#f97316'],
    Z: ['#581c87', '#a855f7']
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
    const total = nodes.reduce((sum, node) => sum + Math.max(node.value, 0), 0);
    if (!total) return [];
    const horizontal = depth % 2 === 0;
    let offset = 0;
    return nodes.map(node => {
      const safeValue = Math.max(node.value, 0);
      const share = total ? safeValue / total : 0;
      const size = share * 100;
      const cell = horizontal
        ? { left: offset, top: 0, width: size, height: 100 }
        : { left: 0, top: offset, width: 100, height: size };
      offset += size;
      return {
        node,
        left: clampPercent(cell.left),
        top: clampPercent(cell.top),
        width: clampPercent(cell.width),
        height: clampPercent(cell.height),
        share: share * 100
      };
    });
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
    if (node.xyz && XYZ_COLORS[node.xyz]) {
      const [c1, c2] = XYZ_COLORS[node.xyz];
      return `linear-gradient(135deg, ${c1}, ${c2})`;
    }
    const idx = Math.abs(hashCode(node.id)) % FALLBACK_GRADIENTS.length;
    const [from, to] = FALLBACK_GRADIENTS[idx];
    return `linear-gradient(135deg, ${from}, ${to})`;
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
