// ════════════════════════════════════════════════════════════
// Rose Artesanatos · render.js
// Todas as funções de renderização de UI
// ════════════════════════════════════════════════════════════

/* ── Orquestrador ─────────────────────────────────────────── */
function renderAll() {
  renderDashboard();
  renderPedidos();
  renderDespacho();
  renderEstoque();
  renderFinanceiro();
  renderEquipe();
  renderConfig();
  renderMLBanner();
  updateBadges();
}

/* ── Badges de alerta no sidebar ─────────────────────────── */
function updateBadges() {
  // .nav-pill usa display:none no CSS; a visibilidade é controlada pela classe .show
  const setPill = (id, text, visible) => {
    const e = document.getElementById(id);
    if (!e) return;
    e.textContent = text;
    e.classList.toggle('show', visible);
  };

  const pend = DB.pedidos.filter(p => p.status === 'pendente').length;
  setPill('pill-pedidos', pend > 0 ? pend : '', pend > 0);

  const baixoEstoque = DB.estoque.filter(i => getEstoqueStatus(i) !== 'ok').length;
  setPill('pill-estoque', baixoEstoque > 0 ? baixoEstoque : '', baixoEstoque > 0);

  const alerts = getAlerts().length;
  setPill('pill-fin', alerts > 0 ? '!' : '', alerts > 0);
}

/* ── Dashboard ───────────────────────────────────────────── */
function renderDashboard() {
  const ym = nowMK();
  const receita = getReceitasMes(ym);
  const despesa = getDespesasMes(ym);
  const lucro   = receita - despesa;
  const margem  = receita > 0 ? lucro / receita * 100 : 0;
  // Cancelados ficam fora da contagem operacional e aparecem à parte.
  const ativos    = DB.pedidos.filter(p => p.status !== STATUS_CANCELADO);
  const canc      = DB.pedidos.length - ativos.length;
  const total     = ativos.length;
  const despPed   = ativos.filter(p => p.status === 'despachado').length;
  const hoje      = ativos.filter(p => (p.criadoEm || '').startsWith(today())).length;

  setText('kpi-pedidos',      total);
  setText('kpi-pedidos-sub',  `${hoje} novo(s) hoje · ${despPed} despachado(s)`
    + (canc ? ` · ${canc} cancelado(s)` : ''));
  setText('kpi-receita',      fmtK(receita));
  setText('kpi-receita-sub',  `${DB.receitas.filter(r => monthKey(r.data)===ym).length} entradas este mês`);
  setText('kpi-despesa',      fmtK(despesa));
  setText('kpi-despesa-sub',  `${getDespesasByCategory(ym).length} categorias`);
  setText('kpi-resultado',    fmtK(lucro));
  setText('kpi-resultado-sub', `margem ${margem.toFixed(1)}%`);
  style('kpi-resultado', 'color', lucro >= 0 ? 'var(--green)' : 'var(--red)');

  // Pedidos recentes (só os que ainda estão na operação)
  const recent = [...ativos].reverse().slice(0, 5);
  const tbody  = qry('#dash-tbody');
  const empty  = qry('#dash-empty');
  if (recent.length && tbody) {
    tbody.innerHTML = recent.map(p => `
      <tr>
        <td><span class="sku-chip">${escapeHTML(p.ml || '-')}</span></td>
        <td>${escapeHTML(p.produto || p.sku || '-')}</td>
        <td>${escapeHTML(p.resp || '-')}</td>
        <td>${badge(p.status)}</td>
        <td>${p.status !== 'despachado'
          ? `<button class="btn btn-ghost btn-sm" onclick="avancarPedido('${p.id}')">→</button>`
          : `<span style="font-size:11px;color:var(--text-muted)">✓</span>`}
        </td>
      </tr>`).join('');
    show(tbody.closest('table'));
    hide(empty);
  } else {
    tbody && hide(tbody.closest('table'));
    show(empty);
  }

  // Alertas
  const alertsEl = qry('#dash-alertas');
  if (alertsEl) alertsEl.innerHTML = buildAlerts(getAlerts(),
    '<div class="alert-item alert-ok"><span class="alert-icon">✅</span><span>Tudo em ordem</span></div>');

  // Mini chart
  drawBarChart('chart-dash', getLast6Months());

  // Horários
  setText('h-corte-disp',    DB.config.hCorte    || '08:00');
  setText('h-despacho-disp', DB.config.hDespacho || '14:00');
}

/* ── Pedidos ─────────────────────────────────────────────── */
// Agrupa uma lista de pedidos por data (criadoEm), com as datas mais recentes
// primeiro. Retorna [[dataISO, [pedidos...]], ...]. Reutilizado na tela e na
// impressão.
function groupPedidosByDate(list) {
  const groups = {};
  list.forEach(p => {
    const k = p.criadoEm || 'sem-data';
    (groups[k] = groups[k] || []).push(p);
  });
  return Object.keys(groups)
    .sort((a, b) => (a === 'sem-data' ? 1 : b === 'sem-data' ? -1 : b.localeCompare(a)))
    .map(k => [k, groups[k]]);
}

function renderPedidos() {
  const filter = val('filter-ped-status') || '';
  const list   = filter ? DB.pedidos.filter(p => p.status === filter) : DB.pedidos;
  const tbody  = qry('#ped-tbody');
  const empty  = qry('#ped-empty');

  if (!list.length || !tbody) {
    tbody && hide(tbody.closest('table'));
    show(empty);
    return;
  }

  const rowHTML = (p, i) => {
    const cancelado = p.status === STATUS_CANCELADO;
    const acoes = cancelado
      ? `<button class="btn btn-ghost btn-sm" title="Reabrir pedido cancelado"
           onclick="reabrirPedido('${p.id}')">↺ Reabrir</button>`
      : `${p.status !== 'despachado'
            ? `<button class="btn btn-ghost btn-sm" title="Avançar status"
                onclick="avancarPedido('${p.id}')">→ Avançar</button>` : ''}
         <button class="btn btn-danger-outline btn-sm" title="Cancelar pedido"
           onclick="cancelarPedido('${p.id}')">⊘ Cancelar</button>`;

    return `
      <tr${cancelado ? ' class="row-cancelada"' : ''}>
        <td>${i + 1}</td>
        <td><span class="sku-chip">${escapeHTML(p.ml || '-')}</span></td>
        <td>
          ${escapeHTML(p.produto || p.sku || '-')}
          ${p.sku && p.produto ? `<div><span class="sku-chip" style="font-size:10px">${escapeHTML(p.sku)}</span></div>` : ''}
        </td>
        <td>${p.qtd || 1}</td>
        <td>${escapeHTML(p.resp || '-')}</td>
        <td>${fmt(p.valor)}</td>
        <td>
          ${badge(p.status)}
          ${cancelado && p.motivoCancel === 'mercado-livre'
            ? '<div class="cancel-origem">via Mercado Livre</div>' : ''}
        </td>
        <td>
          <div class="btn-group">
            ${acoes}
            <button class="btn btn-danger-outline btn-sm" title="Remover do sistema"
              onclick="removerPedido('${p.id}')">✕</button>
          </div>
        </td>
      </tr>`;
  };

  tbody.innerHTML = groupPedidosByDate(list).map(([data, items]) => {
    // Cancelados não entram no total do dia — o valor do dia é o que de fato vale.
    const ativos = items.filter(p => p.status !== STATUS_CANCELADO);
    const canc   = items.length - ativos.length;
    const soma   = ativos.reduce((s, p) => s + Number(p.valor || 0), 0);
    const header = `
      <tr class="group-row">
        <td colspan="8">
          <span class="group-date">${formatDateFull(data)}</span>
          <span class="group-meta">${ativos.length} pedido(s) · ${fmt(soma)}${
            canc ? ` · <span class="group-canc">${canc} cancelado(s)</span>` : ''}</span>
        </td>
      </tr>`;
    return header + items.map((p, i) => rowHTML(p, i)).join('');
  }).join('');

  show(tbody.closest('table'));
  hide(empty);
}

/* ── Despacho ────────────────────────────────────────────── */
function renderDespacho() {
  const tbody = qry('#full-tbody');
  const empty = qry('#full-empty');
  if (DB.enviosFull.length && tbody) {
    tbody.innerHTML = DB.enviosFull.map(e => `
      <tr>
        <td><b>${escapeHTML(e.id)}</b></td>
        <td>${e.data || '-'}</td>
        <td>${e.volumes} vol.</td>
        <td>${badge(e.status)}</td>
      </tr>`).join('');
    show(tbody.closest('table'));
    hide(empty);
  } else {
    tbody && hide(tbody.closest('table'));
    show(empty);
  }
}

/* ── Estoque ─────────────────────────────────────────────── */
function renderEstoque() {
  const filter = val('filter-est') || '';
  const list   = filter ? DB.estoque.filter(i => getEstoqueStatus(i) === filter) : DB.estoque;
  const tbody  = qry('#est-tbody');
  const empty  = qry('#est-empty');

  if (list.length && tbody) {
    tbody.innerHTML = list.map(item => {
      const st  = getEstoqueStatus(item);
      const pct = item.min > 0 ? clamp(item.qtd / item.min * 100, 0, 100) : 100;
      const barColor = st === 'ok' ? 'var(--green)' : st === 'baixo' ? 'var(--amber)' : 'var(--red)';
      return `
        <tr>
          <td><span class="sku-chip">${escapeHTML(item.sku)}</span></td>
          <td>${escapeHTML(item.nome)}</td>
          <td>${escapeHTML(item.local || '—')}</td>
          <td>${item.custo > 0 ? fmt(item.custo) : '—'}</td>
          <td>
            <b>${item.qtd}</b>
            <div class="progress-track" style="height:5px;max-width:64px;margin-top:4px">
              <div class="progress-fill" style="width:${pct.toFixed(0)}%;background:${barColor}"></div>
            </div>
          </td>
          <td>${item.min}</td>
          <td>${badge(st)}</td>
          <td>
            <div class="btn-group">
              <button class="btn btn-ghost btn-sm" onclick="ajustarEstoque('${item.sku}')">Ajustar</button>
              <button class="btn btn-danger-outline btn-sm" onclick="removerSKU('${item.sku}')">✕</button>
            </div>
          </td>
        </tr>`;
    }).join('');
    show(tbody.closest('table'));
    hide(empty);
  } else {
    tbody && hide(tbody.closest('table'));
    show(empty);
  }
}

/* ── Financeiro (orquestrador) ───────────────────────────── */
function renderFinanceiro() {
  renderFinGeral();
  renderReceitas();
  renderDespesas();
  renderFluxo();
  renderDRE();
}

function renderFinGeral() {
  const ym      = nowMK();
  const receita = getReceitasMes(ym);
  const despesa = getDespesasMes(ym);
  const lucro   = receita - despesa;
  const margem  = receita > 0 ? lucro / receita * 100 : 0;
  const ticket  = getTicketMedio(ym);

  setText('fn-receita', fmtK(receita));
  setText('fn-rsub',    `${DB.receitas.filter(r => monthKey(r.data)===ym).length} entradas`);
  setText('fn-despesa', fmtK(despesa));
  setText('fn-dsub',    `${DB.despesas.filter(d => monthKey(d.data)===ym).length} lançamentos`);
  setText('fn-lucro',   fmtK(lucro));
  setText('fn-lsub',    `margem ${margem.toFixed(1)}%`);
  style('fn-lucro', 'color', lucro >= 0 ? 'var(--green)' : 'var(--red)');
  setText('fn-ticket',  fmtK(ticket));

  drawBarChart('chart-fin', getLast6Months());
  drawCategoryChart('cat-chart', ym);

  const el = qry('#fin-alertas');
  if (el) el.innerHTML = buildAlerts(getAlerts(),
    '<div class="alert-item alert-ok"><span class="alert-icon">✅</span><span>Sem alertas financeiros no momento</span></div>');
}

function renderReceitas() {
  populateMesFilter('filter-rec-mes', DB.receitas.map(r => monthKey(r.data)));
  const filter = val('filter-rec-mes') || '';
  const list   = filter ? DB.receitas.filter(r => monthKey(r.data) === filter) : DB.receitas;
  const total  = list.reduce((s, r) => s + Number(r.valor || 0), 0);

  setText('rec-total', fmt(total));

  const tbody = qry('#rec-tbody');
  const empty = qry('#rec-empty');
  if (list.length && tbody) {
    tbody.innerHTML = [...list].sort((a, b) => b.data.localeCompare(a.data)).map(r => `
      <tr>
        <td>${escapeHTML(r.data)}</td>
        <td>
          ${escapeHTML(r.descricao)}
          ${r.subDesc ? `<div style="font-size:11px;color:var(--text-muted)">${escapeHTML(r.subDesc)}</div>` : ''}
        </td>
        <td>${r.origem === 'auto'
          ? '<span class="badge b-auto">Automático</span>'
          : '<span class="sku-chip">Manual</span>'}</td>
        <td style="color:var(--green);font-weight:500">${fmt(r.valor)}</td>
        <td>${r.origem !== 'auto'
          ? `<button class="btn btn-danger-outline btn-sm" onclick="removerReceita('${r.id}')">✕</button>`
          : '<span style="font-size:11px;color:var(--text-muted)">auto</span>'}</td>
      </tr>`).join('');
    show(tbody.closest('table'));
    hide(empty);
  } else {
    tbody && hide(tbody.closest('table'));
    show(empty);
  }
}

function renderDespesas() {
  populateMesFilter('filter-desp-mes', DB.despesas.map(d => monthKey(d.data)));
  populateCatFilter();

  const filterMes = val('filter-desp-mes') || '';
  const filterCat = val('filter-desp-cat') || '';
  const ym = filterMes || nowMK();

  let list = DB.despesas;
  if (filterMes) list = list.filter(d => monthKey(d.data) === filterMes);
  if (filterCat) list = list.filter(d => d.categoria === filterCat);

  const total = DB.despesas
    .filter(d => monthKey(d.data) === ym)
    .reduce((s, d) => s + Number(d.valor || 0), 0);

  setText('desp-total', fmt(total));

  // Recorrentes
  const recEl = qry('#recorrentes-list');
  if (recEl) {
    recEl.innerHTML = DB.despesasRecorrentes.length
      ? DB.despesasRecorrentes.map(t => `
          <div class="recurring-card">
            <div class="rc-info">
              <div class="rc-name">${escapeHTML(t.nome)}</div>
              <div class="rc-meta">${escapeHTML(t.categoria || 'Outros')} · Dia 1 de cada mês</div>
            </div>
            <div class="rc-val">${fmt(t.valor)}<span style="font-size:11px;color:var(--text-muted)">/mês</span></div>
            <button class="btn btn-danger-outline btn-sm" onclick="removerRecorrente('${t.id}')">✕</button>
          </div>`).join('')
      : `<div class="empty-state" style="padding:16px">
           Nenhuma despesa recorrente.
           <button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick="openModal('modal-recorrente')">+ Adicionar</button>
         </div>`;
  }

  const tbody = qry('#desp-tbody');
  const empty = qry('#desp-empty');
  if (list.length && tbody) {
    tbody.innerHTML = [...list].sort((a, b) => b.data.localeCompare(a.data)).map(d => `
      <tr>
        <td>${escapeHTML(d.data)}</td>
        <td>
          ${escapeHTML(d.descricao)}
          ${d.obs ? `<div style="font-size:11px;color:var(--text-muted)">${escapeHTML(d.obs)}</div>` : ''}
        </td>
        <td><span class="sku-chip">${escapeHTML(d.categoria || 'Outros')}</span></td>
        <td style="color:var(--red);font-weight:500">${fmt(d.valor)}</td>
        <td>${badge(d.status === 'pago' ? 'pago' : 'pendpag')}</td>
        <td>${d.auto ? '<span class="badge b-auto">Auto</span>'
          : d.templateId ? '<span class="badge b-recorr">Recorrente</span>'
          : '<span style="font-size:11px;color:var(--text-muted)">Manual</span>'}</td>
        <td>${!d.auto
          ? `<button class="btn btn-danger-outline btn-sm" onclick="removerDespesa('${d.id}')">✕</button>`
          : '—'}</td>
      </tr>`).join('');
    show(tbody.closest('table'));
    hide(empty);
  } else {
    tbody && hide(tbody.closest('table'));
    show(empty);
  }
}

function renderFluxo() {
  const months = getLast6Months();
  drawBarChart('chart-fluxo', months);

  const tbody = qry('#fluxo-tbody');
  const empty = qry('#fluxo-empty');
  const hasData = months.some(m => m.receita > 0 || m.despesa > 0);

  if (hasData && tbody) {
    tbody.innerHTML = months.map(m => {
      const saldo  = m.receita - m.despesa;
      const margem = m.receita > 0 ? (saldo / m.receita * 100).toFixed(1) + '%' : '—';
      return `<tr>
        <td><b>${m.label}</b></td>
        <td style="color:var(--green)">${fmt(m.receita)}</td>
        <td style="color:var(--red)">${fmt(m.despesa)}</td>
        <td style="font-weight:600;color:${saldo >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(saldo)}</td>
        <td>${margem}</td>
      </tr>`;
    }).join('');
    show(tbody.closest('table'));
    hide(empty);
  } else {
    tbody && hide(tbody.closest('table'));
    show(empty);
  }
}

function renderDRE() {
  const sel = document.getElementById('dre-mes');
  if (!sel) return;

  const allYm = [
    ...DB.receitas.map(r => monthKey(r.data)),
    ...DB.despesas.map(d => monthKey(d.data)),
  ];
  populateMesFilter('dre-mes', allYm);

  const ym   = sel.value || nowMK();
  const recs = getReceitasMes(ym);
  const cats = getDespesasByCategory(ym);
  const totalDesp = cats.reduce((s, [, v]) => s + v, 0);
  const resultado = recs - totalDesp;
  const margem    = recs > 0 ? (resultado / recs * 100).toFixed(1) : 0;

  const catRows = cats.length
    ? cats.map(([cat, val]) => `
        <div class="dre-row dre-sub">
          <span>${escapeHTML(cat)}</span>
          <span class="dre-val" style="color:var(--red)">(${fmt(val)})</span>
        </div>`).join('')
    : '<div class="dre-row dre-sub"><span style="color:var(--text-muted)">Nenhuma despesa</span><span>—</span></div>';

  const dreEl = qry('#dre-content');
  if (!dreEl) return;

  dreEl.innerHTML = `
    <div class="dre-row dre-header">RECEITAS</div>
    <div class="dre-row dre-sub">
      <span>Receita de Vendas</span>
      <span class="dre-val" style="color:var(--green)">${fmt(recs)}</span>
    </div>
    <div class="dre-row dre-total">
      <span>Total Receitas</span>
      <span class="dre-val" style="color:var(--green)">${fmt(recs)}</span>
    </div>

    <div class="dre-row dre-header">DESPESAS OPERACIONAIS</div>
    ${catRows}
    <div class="dre-row dre-total">
      <span>Total Despesas</span>
      <span class="dre-val" style="color:var(--red)">(${fmt(totalDesp)})</span>
    </div>

    <div class="dre-row ${resultado >= 0 ? 'dre-profit' : 'dre-loss'}">
      <span>${resultado >= 0 ? '✅ LUCRO LÍQUIDO' : '❌ PREJUÍZO'}</span>
      <div style="text-align:right">
        <div class="dre-val">${fmt(resultado)}</div>
        <div style="font-size:11.5px;opacity:0.8;margin-top:2px">Margem ${margem}%</div>
      </div>
    </div>`;
}

/* ── Equipe ──────────────────────────────────────────────── */
function renderEquipe() {
  const grid = qry('#team-grid');
  if (!grid) return;
  grid.innerHTML = TEAM.map(t => `
    <div class="team-card">
      <div class="team-header">
        <div class="team-avatar" style="background:${t.c}">${t.ini}</div>
        <div>
          <div class="team-name">${t.n}</div>
          <div class="team-role">${t.r}</div>
        </div>
      </div>
      <ul class="task-list">
        ${t.tasks.map(task => `<li class="task-item"><span class="task-bullet">●</span>${task}</li>`).join('')}
      </ul>
    </div>`).join('');
}

/* ── Configurações ───────────────────────────────────────── */
function renderConfig() {
  const c = DB.config;
  setVal('cfg-taxa-ml',      c.taxaML        ?? 12);
  setVal('cfg-custo-emb',    c.custoEmbalagem ?? 3.50);
  setVal('cfg-nome',         c.nomeEmpresa   || '');
  setVal('cfg-h-corte',      c.hCorte        || '08:00');
  setVal('cfg-h-despacho',   c.hDespacho     || '14:00');

  const badge = qry('#cfg-ml-badge');
  const txt   = qry('#cfg-status-text');
  if (badge) badge.className = 'ml-status-badge' + (c.mlConnected ? ' on' : '');
  if (badge) badge.textContent = c.mlConnected ? 'Conectado' : 'Não conectado';
  if (txt)   txt.textContent   = c.mlConnected ? '✅ Conectado ao Mercado Livre' : 'Não conectado';
}

function renderMLBanner() {
  const c   = DB.config;
  const dot = qry('#ml-banner-dot');
  const txt = qry('#ml-banner-text');
  const btn = qry('#btn-ml-import');

  // Rodapé da sidebar
  const sfDot = qry('#sf-dot');
  const sfTxt = qry('#sf-ml-text');
  if (sfDot) sfDot.className = 'dot' + (c.mlConnected ? ' connected' : '');
  if (sfTxt) sfTxt.textContent = c.mlConnected ? 'ML: Conectado' : 'ML: Não conectado';

  if (!dot) return;

  if (c.mlConnected) {
    dot.className = 'ml-banner-dot on';
    txt.innerHTML = '<b>Mercado Livre conectado.</b> Use o botão para importar novos pedidos.';
    show(btn);
  } else {
    dot.className = 'ml-banner-dot';
    txt.innerHTML = 'Configure a integração com o <b>Mercado Livre</b> em Configurações.';
    hide(btn);
  }
}

/* ── Helpers de UI ───────────────────────────────────────── */
function badge(status) {
  const [cls, lbl] = STATUS_BADGES[status] || ['badge-muted', status];
  return `<span class="badge ${cls}">${lbl}</span>`;
}

function buildAlerts(alerts, emptyHtml) {
  if (!alerts.length) return emptyHtml;
  const cssClass = { danger: 'alert-error', warning: 'alert-warn', ok: 'alert-ok' };
  return alerts.map(a =>
    `<div class="alert-item ${cssClass[a.type] || 'alert-warn'}">
      <span class="alert-icon">${a.icon}</span>
      <span>${a.msg}</span>
    </div>`).join('');
}

function populateMesFilter(id, dates) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const cur = sel.value;
  const months = [...new Set(dates.filter(Boolean))].sort().reverse();
  const first = sel.options[0];
  sel.innerHTML = '';
  sel.appendChild(first || Object.assign(document.createElement('option'),
    { value: '', textContent: 'Todos os meses' }));
  months.forEach(ym => {
    const o = document.createElement('option');
    o.value = ym; o.textContent = monthLabel(ym);
    sel.appendChild(o);
  });
  sel.value = months.includes(cur) ? cur : (months.includes(nowMK()) ? nowMK() : '');
}

function populateCatFilter() {
  const sel = document.getElementById('filter-desp-cat');
  if (!sel) return;
  const cur  = sel.value;
  const cats = [...new Set(DB.despesas.map(d => d.categoria).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Todas categorias</option>';
  cats.forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
  if (cats.includes(cur)) sel.value = cur;
}

/* ── Mini-helpers DOM ────────────────────────────────────── */
const qry  = (s)       => document.querySelector(s);
const setText = (id, t)  => { const e = document.getElementById(id); if (e) e.textContent = t; };
const setEl   = (id, t, v) => { const e = document.getElementById(id); if (e) { e.textContent = t; e.style.display = v ? '' : 'none'; } };
const setElVisible = (id, v) => { const e = document.getElementById(id); if (e) e.style.display = v ? '' : 'none'; };
const style = (id, prop, v) => { const e = document.getElementById(id); if (e) e.style[prop] = v; };
const show  = (e)      => { if (e) e.style.display = ''; };
const hide  = (e)      => { if (e) e.style.display = 'none'; };
const val   = (id)     => { const e = document.getElementById(id); return e ? e.value : ''; };
const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
