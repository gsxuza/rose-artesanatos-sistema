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
  const pend = DB.pedidos.filter(p => p.status === 'pendente').length;
  setEl('nb-pedidos', pend > 0 ? pend : '', pend > 0);

  const alerts = getAlerts().length;
  setElVisible('nb-fin', alerts > 0);
}

/* ── Dashboard ───────────────────────────────────────────── */
function renderDashboard() {
  const ym = nowMK();
  const receita = getReceitasMes(ym);
  const despesa = getDespesasMes(ym);
  const lucro   = receita - despesa;
  const margem  = receita > 0 ? lucro / receita * 100 : 0;
  const total   = DB.pedidos.length;
  const despPed = DB.pedidos.filter(p => p.status === 'despachado').length;
  const hoje    = DB.pedidos.filter(p => (p.criadoEm || '').startsWith(today())).length;

  setText('dk-pedidos',   total);
  setText('dk-psub',      `${hoje} novo(s) hoje · ${despPed} despachado(s)`);
  setText('dk-receita',   fmtK(receita));
  setText('dk-rsub',      `${DB.receitas.filter(r => monthKey(r.data)===ym).length} entradas este mês`);
  setText('dk-despesa',   fmtK(despesa));
  setText('dk-dsub',      `${getDespesasByCategory(ym).length} categorias`);
  setText('dk-lucro',     fmtK(lucro));
  setText('dk-lsub',      `margem ${margem.toFixed(1)}%`);
  style('dk-lucro', 'color', lucro >= 0 ? 'var(--green-500)' : 'var(--red-500)');

  // Pedidos recentes
  const recent = [...DB.pedidos].reverse().slice(0, 5);
  const tbody  = qry('#dash-table');
  const empty  = qry('#dash-empty');
  if (recent.length && tbody) {
    tbody.innerHTML = recent.map(p => `
      <tr>
        <td><span class="sku">${p.ml || '-'}</span></td>
        <td class="cell-trunc">${p.produto || p.sku || '-'}</td>
        <td>${p.resp || '-'}</td>
        <td>${badge(p.status)}</td>
        <td>${p.status !== 'despachado'
          ? `<button class="btn btn-ghost btn-xs" onclick="avancarPedido('${p.id}')">→</button>`
          : `<span style="font-size:11px;color:var(--muted)">✓</span>`}
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
    '<div class="no-data">✅ Tudo em ordem</div>');

  // Mini chart
  drawBarChart('dash-chart', getLast6Months());

  // Horários
  setText('h-corte-disp',  DB.config.hCorte    || '08:00');
  setText('h-desp-disp',   DB.config.hDespacho || '14:00');
}

/* ── Pedidos ─────────────────────────────────────────────── */
function renderPedidos() {
  const filter = val('filter-pedido-status') || '';
  const list   = filter ? DB.pedidos.filter(p => p.status === filter) : DB.pedidos;
  const tbody  = qry('#pedidos-table');
  const empty  = qry('#pedidos-empty');

  if (list.length && tbody) {
    tbody.innerHTML = [...list].reverse().map((p, i) => `
      <tr>
        <td class="cell-num">${i + 1}</td>
        <td><span class="sku">${p.ml || '-'}</span></td>
        <td>
          <div class="cell-main">${p.produto || p.sku || '-'}</div>
          ${p.sku && p.produto ? `<span class="sku" style="font-size:10px">${p.sku}</span>` : ''}
        </td>
        <td>${p.qtd || 1}</td>
        <td>${p.resp || '-'}</td>
        <td class="cell-money">${fmt(p.valor)}</td>
        <td>${badge(p.status)}</td>
        <td>
          <div class="cell-actions">
            ${p.status !== 'despachado'
              ? `<button class="btn btn-ghost btn-xs" title="Avançar status"
                  onclick="avancarPedido('${p.id}')">→ Avançar</button>` : ''}
            <button class="btn btn-danger-ghost btn-xs" onclick="removerPedido('${p.id}')">✕</button>
          </div>
        </td>
      </tr>`).join('');
    show(tbody.closest('.card'));
    hide(empty);
  } else {
    tbody && hide(tbody.closest('.card'));
    show(empty);
  }
}

/* ── Despacho ────────────────────────────────────────────── */
function renderDespacho() {
  const tbody = qry('#full-table');
  const empty = qry('#full-empty');
  if (DB.enviosFull.length && tbody) {
    tbody.innerHTML = DB.enviosFull.map(e => `
      <tr>
        <td><b>${e.id}</b></td>
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
  const filter = val('filter-estoque') || '';
  const list   = filter ? DB.estoque.filter(i => getEstoqueStatus(i) === filter) : DB.estoque;
  const tbody  = qry('#estoque-table');
  const empty  = qry('#estoque-empty');

  if (list.length && tbody) {
    tbody.innerHTML = list.map(item => {
      const st  = getEstoqueStatus(item);
      const pct = item.min > 0 ? clamp(item.qtd / item.min * 100, 0, 100) : 100;
      const barColor = st === 'ok' ? 'var(--green-500)' : st === 'baixo' ? 'var(--amber-500)' : 'var(--red-500)';
      return `
        <tr>
          <td><span class="sku">${item.sku}</span></td>
          <td class="cell-main">${item.nome}</td>
          <td class="cell-muted">${item.local || '—'}</td>
          <td>${item.custo > 0 ? fmt(item.custo) : '—'}</td>
          <td>
            <div class="qty-wrap">
              <b>${item.qtd}</b>
              <div class="mini-bar"><div style="width:${pct.toFixed(0)}%;background:${barColor}"></div></div>
            </div>
          </td>
          <td class="cell-muted">${item.min}</td>
          <td>${badge(st)}</td>
          <td>
            <div class="cell-actions">
              <button class="btn btn-ghost btn-xs" onclick="ajustarEstoque('${item.sku}')">Ajustar</button>
              <button class="btn btn-danger-ghost btn-xs" onclick="removerSKU('${item.sku}')">✕</button>
            </div>
          </td>
        </tr>`;
    }).join('');
    show(tbody.closest('.card'));
    hide(empty);
  } else {
    tbody && hide(tbody.closest('.card'));
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
  style('fn-lucro', 'color', lucro >= 0 ? 'var(--green-500)' : 'var(--red-500)');
  setText('fn-ticket',  fmtK(ticket));

  drawBarChart('fin-chart', getLast6Months());
  drawCategoryChart('cat-chart', ym);

  const el = qry('#fin-alertas');
  if (el) el.innerHTML = buildAlerts(getAlerts(),
    '<div class="no-data">Sem alertas financeiros no momento</div>');
}

function renderReceitas() {
  populateMesFilter('filter-rec-mes', DB.receitas.map(r => monthKey(r.data)));
  const filter = val('filter-rec-mes') || '';
  const list   = filter ? DB.receitas.filter(r => monthKey(r.data) === filter) : DB.receitas;
  const total  = list.reduce((s, r) => s + Number(r.valor || 0), 0);

  setText('rec-total', fmt(total));

  const tbody = qry('#rec-table');
  const empty = qry('#rec-empty');
  if (list.length && tbody) {
    tbody.innerHTML = [...list].sort((a, b) => b.data.localeCompare(a.data)).map(r => `
      <tr>
        <td class="cell-muted">${r.data}</td>
        <td>
          <div class="cell-main">${r.descricao}</div>
          ${r.subDesc ? `<div class="cell-sub">${r.subDesc}</div>` : ''}
        </td>
        <td>${r.origem === 'auto'
          ? '<span class="chip chip-blue">Automático</span>'
          : '<span class="chip chip-muted">Manual</span>'}</td>
        <td class="cell-money-pos">${fmt(r.valor)}</td>
        <td>${r.origem !== 'auto'
          ? `<button class="btn btn-danger-ghost btn-xs" onclick="removerReceita('${r.id}')">✕</button>`
          : '<span class="cell-muted" style="font-size:11px">auto</span>'}</td>
      </tr>`).join('');
    show(tbody.closest('.card'));
    hide(empty);
  } else {
    tbody && hide(tbody.closest('.card'));
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
          <div class="recurring-row">
            <div class="recurring-info">
              <div class="recurring-name">${t.nome}</div>
              <div class="recurring-meta">${t.categoria} · Dia 1 de cada mês</div>
            </div>
            <div class="recurring-val">${fmt(t.valor)}<span style="font-size:11px;color:var(--muted)">/mês</span></div>
            <button class="btn btn-danger-ghost btn-xs" onclick="removerRecorrente('${t.id}')">✕</button>
          </div>`).join('')
      : `<div class="dashed-empty">
           Nenhuma despesa recorrente.
           <button class="btn btn-ghost btn-xs" style="margin-left:8px" onclick="openModal('modal-recorrente')">+ Adicionar</button>
         </div>`;
  }

  const tbody = qry('#desp-table');
  const empty = qry('#desp-empty');
  if (list.length && tbody) {
    tbody.innerHTML = [...list].sort((a, b) => b.data.localeCompare(a.data)).map(d => `
      <tr>
        <td class="cell-muted">${d.data}</td>
        <td>
          <div class="cell-main">${d.descricao}</div>
          ${d.obs ? `<div class="cell-sub">${d.obs}</div>` : ''}
        </td>
        <td><span class="chip chip-muted">${d.categoria || 'Outros'}</span></td>
        <td class="cell-money-neg">${fmt(d.valor)}</td>
        <td>${badge(d.status === 'pago' ? 'pago' : 'pendpag')}</td>
        <td>${d.auto ? '<span class="chip chip-blue">Auto</span>'
          : d.templateId ? '<span class="chip chip-purple">Recorrente</span>'
          : '<span class="cell-muted" style="font-size:11px">Manual</span>'}</td>
        <td>${!d.auto
          ? `<button class="btn btn-danger-ghost btn-xs" onclick="removerDespesa('${d.id}')">✕</button>`
          : '—'}</td>
      </tr>`).join('');
    show(tbody.closest('.card'));
    hide(empty);
  } else {
    tbody && hide(tbody.closest('.card'));
    show(empty);
  }
}

function renderFluxo() {
  const months = getLast6Months();
  drawBarChart('fluxo-chart', months);

  const tbody = qry('#fluxo-table');
  const empty = qry('#fluxo-empty');
  const hasData = months.some(m => m.receita > 0 || m.despesa > 0);

  if (hasData && tbody) {
    tbody.innerHTML = months.map(m => {
      const saldo  = m.receita - m.despesa;
      const margem = m.receita > 0 ? (saldo / m.receita * 100).toFixed(1) + '%' : '—';
      return `<tr>
        <td><b>${m.label}</b></td>
        <td class="cell-money-pos">${fmt(m.receita)}</td>
        <td class="cell-money-neg">${fmt(m.despesa)}</td>
        <td style="font-weight:600;color:${saldo >= 0 ? 'var(--green-500)' : 'var(--red-500)'}">${fmt(saldo)}</td>
        <td class="cell-muted">${margem}</td>
      </tr>`;
    }).join('');
    show(tbody.closest('.card'));
    hide(empty);
  } else {
    tbody && hide(tbody.closest('.card'));
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
          <span>${cat}</span>
          <span class="dre-val neg">(${fmt(val)})</span>
        </div>`).join('')
    : '<div class="dre-row dre-sub"><span style="color:var(--muted)">Nenhuma despesa</span><span>—</span></div>';

  const dreEl = qry('#dre-body');
  if (!dreEl) return;

  dreEl.innerHTML = `
    <div class="dre-row dre-section">RECEITAS</div>
    <div class="dre-row dre-sub">
      <span>Receita de Vendas</span>
      <span class="dre-val pos">${fmt(recs)}</span>
    </div>
    <div class="dre-row dre-total">
      <span>Total Receitas</span>
      <span class="dre-val pos">${fmt(recs)}</span>
    </div>

    <div class="dre-row dre-section">DESPESAS OPERACIONAIS</div>
    ${catRows}
    <div class="dre-row dre-total">
      <span>Total Despesas</span>
      <span class="dre-val neg">(${fmt(totalDesp)})</span>
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
const TEAM = [
  { n:'Fábio',   r:'Gestor Geral',         ini:'F',  c:'var(--accent)',
    tasks:['Supervisão geral da operação','Gestão de e-commerce','Financeiro e administrativo','Suporte à equipe'] },
  { n:'Roseli',  r:'Gestora Geral',         ini:'R',  c:'var(--accent)',
    tasks:['Supervisão presencial','Gestão de produção','Expedição','Alinhamento de processos'] },
  { n:'Yasmin',  r:'Fiscal & Embalagem',    ini:'Y',  c:'var(--blue-500)',
    tasks:['Emitir NFs e etiquetas do dia','Imprimir relação de Envios Full','Conferir pedidos embalados vs sistema','Registrar horários de corte e despacho'] },
  { n:'Daniel',  r:'Separação & Despacho',  ini:'D',  c:'var(--green-500)',
    tasks:['Separar produtos dos pedidos do dia','Informar quantidade embalados à Yasmin','Embalar pedidos','Levar pedidos ao despacho (com Luiz)'] },
  { n:'Luiz',    r:'Apoio & Despacho',      ini:'L',  c:'var(--amber-500)',
    tasks:['Apoiar Daniel na separação','Iniciar embalagem durante impressão','Levar pedidos ao despacho (com Daniel)'] },
  { n:'Lucas',   r:'Operador de Máquinas',  ini:'Lc', c:'#7040A0',
    tasks:['Operar 2 máquinas de corte MDF','Destacar produtos para expedição','Apoio em demandas operacionais'] },
];

function renderEquipe() {
  const grid = qry('#equipe-grid');
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
      <ul class="team-tasks">
        ${t.tasks.map(task => `<li><span class="task-dot"></span>${task}</li>`).join('')}
      </ul>
    </div>`).join('');
}

/* ── Configurações ───────────────────────────────────────── */
function renderConfig() {
  const c = DB.config;
  setVal('cfg-backend-url',  c.backendUrl    || '');
  setVal('cfg-taxa-ml',      c.taxaML        ?? 12);
  setVal('cfg-custo-emb',    c.custoEmbalagem ?? 3.50);
  setVal('cfg-nome',         c.nomeEmpresa   || '');
  setVal('cfg-h-corte',      c.hCorte        || '08:00');
  setVal('cfg-h-despacho',   c.hDespacho     || '14:00');

  const lbl = qry('#ml-status-label');
  if (!lbl) return;
  if (c.mlConnected) {
    lbl.textContent = '✅ Conectado ao Mercado Livre';
    lbl.style.color = 'var(--green-500)';
  } else if (c.backendUrl) {
    lbl.textContent = '🟡 Backend configurado — clique em Conectar';
    lbl.style.color = 'var(--amber-500)';
  } else {
    lbl.textContent = 'Não conectado';
    lbl.style.color = 'var(--muted)';
  }
}

function renderMLBanner() {
  const c   = DB.config;
  const dot = qry('#ml-dot');
  const txt = qry('#ml-banner-text');
  const btn = qry('#btn-import-ml');

  if (!dot) return;

  if (c.mlConnected) {
    dot.className = 'ml-dot connected';
    txt.innerHTML = '<b>Mercado Livre conectado.</b> Use o botão para importar novos pedidos.';
    show(btn);
  } else if (c.backendUrl) {
    dot.className = 'ml-dot warning';
    txt.innerHTML = 'Backend configurado. <b>Autorize sua conta ML</b> em Configurações.';
    hide(btn);
  } else {
    dot.className = 'ml-dot';
    txt.innerHTML = 'Configure a integração com o <b>Mercado Livre</b> em Configurações.';
    hide(btn);
  }
}

/* ── Helpers de UI ───────────────────────────────────────── */
const STATUS_BADGES = {
  pendente:   ['badge-amber',  'Pendente'],
  separando:  ['badge-blue',   'Separando'],
  embalado:   ['badge-green',  'Embalado'],
  despachado: ['badge-purple', 'Despachado'],
  pago:       ['badge-green',  'Pago'],
  pendpag:    ['badge-amber',  'Pendente'],
  ok:         ['badge-green',  'OK'],
  baixo:      ['badge-amber',  'Baixo'],
  critico:    ['badge-red',    'Crítico'],
};

function badge(status) {
  const [cls, lbl] = STATUS_BADGES[status] || ['badge-muted', status];
  return `<span class="badge ${cls}">${lbl}</span>`;
}

function buildAlerts(alerts, emptyHtml) {
  if (!alerts.length) return emptyHtml;
  return alerts.map(a =>
    `<div class="alert alert-${a.type}">
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
