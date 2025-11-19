(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.ABCXYZTreemap = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const ABC_ORDER = ['A', 'B', 'C'];
  const XYZ_ORDER = ['X', 'Y', 'Z'];
  const COLORS = {
    X: ['#134e4a', '#22c55e'],
    Y: ['#78350f', '#f97316'],
    Z: ['#581c87', '#a855f7']
  };

  function normalizeCounts(matrixCounts = {}) {
    const normalized = {
      A: { X: 0, Y: 0, Z: 0 },
      B: { X: 0, Y: 0, Z: 0 },
      C: { X: 0, Y: 0, Z: 0 }
    };

    ABC_ORDER.forEach(a => {
      const row = matrixCounts[a] || {};
      XYZ_ORDER.forEach(x => {
        const val = Number(row[x]);
        normalized[a][x] = Number.isFinite(val) && val > 0 ? val : 0;
      });
    });

    return normalized;
  }

  function computeTreemapLayout(matrixCounts) {
    const normalized = normalizeCounts(matrixCounts);
    const total = ABC_ORDER.reduce((sum, a) => {
      return sum + XYZ_ORDER.reduce((rowSum, x) => rowSum + normalized[a][x], 0);
    }, 0);

    const rows = [];
    if (!total) {
      return { total: 0, rows };
    }

    let offset = 0;
    ABC_ORDER.forEach(a => {
      const rowCounts = normalized[a];
      const rowTotal = XYZ_ORDER.reduce((rowSum, x) => rowSum + rowCounts[x], 0);
      if (!rowTotal) {
        return;
      }
      const rowShare = (rowTotal / total) * 100;
      const rowLayout = {
        label: a,
        value: rowTotal,
        share: rowShare,
        top: offset,
        height: rowShare,
        cells: []
      };

      let rowOffset = 0;
      XYZ_ORDER.forEach(x => {
        const count = rowCounts[x];
        if (!count) {
          return;
        }
        const width = (count / rowTotal) * 100;
        rowLayout.cells.push({
          label: `${a}${x}`,
          count,
          left: rowOffset,
          width,
          shareOfTotal: (count / total) * 100,
          abc: a,
          xyz: x,
          gradient: COLORS[x] || ['#0f172a', '#1f2937']
        });
        rowOffset += width;
      });

      rows.push(rowLayout);
      offset += rowShare;
    });

    return { total, rows };
  }

  function renderTreemap(el, matrixCounts) {
    if (!el) return;

    const layout = computeTreemapLayout(matrixCounts);
    if (!layout.total || !layout.rows.length) {
      el.innerHTML = '<div class="treemap-empty">Нет данных для визуализации.</div>';
      return;
    }

    const html = layout.rows.map(row => {
      const rowLabel = `${row.label} — ${row.share.toFixed(1)}%`;
      const cellsHtml = row.cells.map(cell => {
        const gradient = `linear-gradient(135deg, ${cell.gradient[0]}, ${cell.gradient[1]})`;
        const title = `${cell.label}: ${cell.count} SKU (${cell.shareOfTotal.toFixed(1)}% от общего числа)`;
        return (
          `<div class="treemap-cell" style="left:${cell.left}%;width:${cell.width}%;background:${gradient};" title="${title}">` +
            `<div class="treemap-cell-label"><div>${cell.label}</div><div>${cell.count} SKU</div></div>` +
          '</div>'
        );
      }).join('');

      return (
        `<div class="treemap-row" style="top:${row.top}%;height:${row.height}%;">` +
          `<div class="treemap-row-label">${rowLabel}</div>` +
          cellsHtml +
        '</div>'
      );
    }).join('');

    el.innerHTML = html;
  }

  return {
    renderTreemap,
    computeTreemapLayout,
    normalizeCounts
  };
});
