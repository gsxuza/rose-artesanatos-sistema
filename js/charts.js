
// Rose Artesanatos · charts.js
// Renderização de gráficos SVG
// ════════════════════════════════════════════════════════════

const C = {
  receita: '#2A6449',
  despesa: '#B84C1E',
  grid:    '#EEE4D8',
  axis:    '#B8A898',
  label:   '#8A7060',
  bg:      '#F7F3EE',
};

const CAT_COLORS = [
  '#B84C1E','#C47D1A','#2A5A8A','#2A6449',
  '#7040A0','#3A8A6A','#8A4020','#2A7A8A',
];

/* ── Gráfico de barras (últimos 6 meses) ─────────────────── */
function drawBarChart(containerId, months) {
  const el = document.getElementById(containerId);
  if (!el) return;

  // viewBox nas dimensões reais do container (1:1 com os pixels), para o SVG
  // preencher exatamente a caixa em qualquer largura de tela. Fallback quando o
  // elemento está oculto (clientWidth/Height = 0) — é redesenhado ao exibir.
  const W = Math.max(Math.round(el.clientWidth)  || 600, 300);
  const H = Math.max(Math.round(el.clientHeight) || 180, 150);
  const pad = { t: 20, r: 16, b: 48, l: 54 };
  const cW = W - pad.l - pad.r;
  const cH = H - pad.t - pad.b;
  const maxVal = Math.max(...months.map(m => Math.max(m.receita, m.despesa)), 100);
  const slotW  = cW / months.length;
  const barW   = Math.min(slotW * 0.3, 24);

  // Grid horizontal
  let grid = '';
  [0.25, 0.5, 0.75, 1].forEach(p => {
    const y   = pad.t + cH * (1 - p);
    const val = maxVal * p;
    const lbl = val >= 1000 ? 'R$' + (val / 1000).toFixed(0) + 'k' : 'R$' + Math.round(val);
    grid += `<line x1="${pad.l}" y1="${y.toFixed(0)}" x2="${W - pad.r}" y2="${y.toFixed(0)}"
              stroke="${C.grid}" stroke-width="1" stroke-dasharray="4 3"/>`;
    grid += `<text x="${pad.l - 6}" y="${(y + 4).toFixed(0)}" text-anchor="end"
              font-size="9.5" fill="${C.axis}" font-family="DM Sans,sans-serif">${lbl}</text>`;
  });

  // Baseline
  grid += `<line x1="${pad.l}" y1="${pad.t + cH}" x2="${W - pad.r}" y2="${pad.t + cH}"
            stroke="${C.axis}" stroke-width="1.5"/>`;

  // Barras + labels
  let bars = '', labels = '';
  months.forEach((m, i) => {
    const cx = pad.l + i * slotW + slotW / 2;

    if (m.receita > 0) {
      const h = Math.max((m.receita / maxVal) * cH, 2);
      const y = pad.t + cH - h;
      bars += `<rect x="${(cx - barW - 2).toFixed(1)}" y="${y.toFixed(1)}"
                width="${barW}" height="${h.toFixed(1)}"
                fill="${C.receita}" rx="3" opacity="0.9">
                <title>Receita ${m.label}: ${fmt(m.receita)}</title></rect>`;
    }

    if (m.despesa > 0) {
      const h = Math.max((m.despesa / maxVal) * cH, 2);
      const y = pad.t + cH - h;
      bars += `<rect x="${(cx + 2).toFixed(1)}" y="${y.toFixed(1)}"
                width="${barW}" height="${h.toFixed(1)}"
                fill="${C.despesa}" rx="3" opacity="0.9">
                <title>Despesas ${m.label}: ${fmt(m.despesa)}</title></rect>`;
    }

    labels += `<text x="${cx.toFixed(0)}" y="${(H - 8).toFixed(0)}" text-anchor="middle"
                font-size="11" fill="${C.label}" font-family="DM Sans,sans-serif">${m.label}</text>`;
  });

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
         xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">
      ${grid}${bars}${labels}
    </svg>`;
}

/* ── Gráfico de categorias (barras horizontais) ──────────── */
function drawCategoryChart(containerId, ym) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const cats = getDespesasByCategory(ym);
  if (!cats.length) {
    el.innerHTML = `<div style="text-align:center;padding:28px 0;color:${C.axis};font-size:13px">
      Nenhuma despesa registrada${ym ? ' neste mês' : ''}</div>`;
    return;
  }

  const max = cats[0][1];
  el.innerHTML = cats.slice(0, 7).map(([cat, val], i) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:11px">
      <div style="width:9px;height:9px;border-radius:2px;flex-shrink:0;
                  background:${CAT_COLORS[i % CAT_COLORS.length]}"></div>
      <div style="font-size:12.5px;color:#4A3828;flex:1;overflow:hidden;
                  text-overflow:ellipsis;white-space:nowrap" title="${cat}">${cat}</div>
      <div style="flex:0 0 100px;height:7px;background:#F2EBE1;border-radius:4px;overflow:hidden">
        <div style="height:100%;border-radius:4px;transition:width .4s ease;
                    width:${(val / max * 100).toFixed(1)}%;
                    background:${CAT_COLORS[i % CAT_COLORS.length]}"></div>
      </div>
      <div style="font-size:12px;color:#8A7060;min-width:88px;text-align:right;
                  font-variant-numeric:tabular-nums">${fmt(val)}</div>
    </div>`).join('');
}
