// ════════════════════════════════════════════════════════════
// Rose Artesanatos · app.js
// Inicialização, navegação, modais, toast e utilitários de UI
// ════════════════════════════════════════════════════════════

/* ── Navegação principal ─────────────────────────────────── */
let currentSection = 'dashboard';

function goto(section) {
  // Sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + section);
  if (sec) sec.classList.add('active');

  // Sidebar links
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll(`.nav-link[data-sec="${section}"]`).forEach(l => l.classList.add('active'));

  // Bottom nav (mobile)
  document.querySelectorAll('.bnav').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`.bnav[data-sec="${section}"]`).forEach(b => b.classList.add('active'));

  // Topbar
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = SECTION_TITLES[section] || section;

  // Botão de ação contextual no topbar
  const topBtn    = document.getElementById('topbar-cta');
  const topBtnMap = {
    pedidos:    { label: '+ Novo Pedido',  fn: () => openModal('modal-pedido') },
    estoque:    { label: '+ Novo SKU',     fn: () => openModal('modal-sku') },
    financeiro: { label: '+ Despesa',      fn: () => openModal('modal-despesa') },
    despacho:   { label: '+ Envio Full',   fn: () => openModal('modal-full') },
  };
  if (topBtn) {
    const act = topBtnMap[section];
    if (act) { topBtn.textContent = act.label; topBtn.onclick = act.fn; topBtn.style.display = ''; }
    else      { topBtn.style.display = 'none'; }
  }

  currentSection = section;
  closeSidebar();
  renderAll();
}

/* ── Sub-abas financeiro ─────────────────────────────────── */
function finTab(tab, btn) {
  document.querySelectorAll('.fin-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else document.querySelectorAll(`.fin-tab[data-fin="${tab}"]`).forEach(b => b.classList.add('active'));
  document.querySelectorAll('.fin-pane').forEach(p => p.classList.remove('active'));
  const pane = document.getElementById('fin-' + tab);
  if (pane) pane.classList.add('active');
  renderAll();
}

/* ── Sidebar (mobile) ────────────────────────────────────── */
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('overlay');
  const hamburger = document.getElementById('hamburger');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
  hamburger.classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('overlay')?.classList.remove('open');
  document.getElementById('hamburger')?.classList.remove('open');
}

/* ── Modais ──────────────────────────────────────────────── */
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('open');
  // Preenche data de hoje em inputs date vazios
  m.querySelectorAll('input[type=date]').forEach(i => { if (!i.value) i.value = today(); });
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// Fecha modal ao clicar no backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('open');
  }
});

/* ── Toast ───────────────────────────────────────────────── */
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' toast-' + type : '');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ── Impressão da lista de pedidos ───────────────────────── */
// Pedidos respeitando o filtro de status da tela.
// Sem filtro explícito, os cancelados ficam de fora: a lista impressa é o que a
// equipe vai separar e despachar — imprimir uma venda cancelada faz a operação
// separar um produto que não vai sair.
function pedidosFiltrados() {
  const filter = getInputValue('filter-ped-status') || '';
  if (filter) return DB.pedidos.filter(p => p.status === filter);
  return DB.pedidos.filter(p => p.status !== STATUS_CANCELADO);
}

// Abre o modal para escolher quais dias entram na impressão.
function imprimirPedidos() {
  const list = pedidosFiltrados();
  if (!list.length) {
    showToast('Nenhum pedido para imprimir com este filtro.', 'danger');
    return;
  }

  const cont = document.getElementById('imp-datas');
  if (cont) {
    cont.innerHTML = groupPedidosByDate(list).map(([data, items]) => {
      const soma = items.reduce((s, p) => s + Number(p.valor || 0), 0);
      return `
        <label class="imp-date-row">
          <input type="checkbox" class="imp-data" value="${data}" checked>
          <span class="imp-date-label">${formatDateFull(data)}</span>
          <span class="imp-date-meta">${items.length} pedido(s) · ${fmt(soma)}</span>
        </label>`;
    }).join('');
  }

  const filter = getInputValue('filter-ped-status') || '';
  setText('imp-info', filter
    ? `Filtro ativo: ${(STATUS_BADGES[filter] || ['', filter])[1]}. Selecione os dias:`
    : 'Selecione os dias que deseja imprimir:');

  openModal('modal-imprimir');
}

function impSelecionarTodos(v) {
  document.querySelectorAll('.imp-data').forEach(c => { c.checked = v; });
}

function impSomenteHoje() {
  const h = today();
  document.querySelectorAll('.imp-data').forEach(c => { c.checked = (c.value === h); });
}

function confirmarImpressao() {
  const sel = [...document.querySelectorAll('.imp-data:checked')].map(c => c.value);
  if (!sel.length) { showToast('Selecione pelo menos um dia para imprimir.', 'danger'); return; }
  const list = pedidosFiltrados().filter(p => sel.includes(p.criadoEm || 'sem-data'));
  closeModal('modal-imprimir');
  gerarImpressao(list, sel.length);
}

// Monta a página de impressão com os pedidos dos dias escolhidos.
function gerarImpressao(list, qtdDias) {
  const filter      = getInputValue('filter-ped-status') || '';
  const empresa     = DB.config.nomeEmpresa || 'Rose Artesanatos';
  const statusLabel = filter ? (STATUS_BADGES[filter]?.[1] || filter) : 'Todos os status';
  const agora       = new Date().toLocaleString('pt-BR');
  const totalGeral  = list.reduce((s, p) => s + Number(p.valor || 0), 0);

  const corpo = groupPedidosByDate(list).map(([data, items]) => {
    const soma = items.reduce((s, p) => s + Number(p.valor || 0), 0);
    const qtdTotal = items.reduce((s, p) => s + Number(p.qtd || 1), 0);
    const linhas = items.map((p, i) => `
      <tr>
        <td class="chk">☐</td>
        <td class="c">${i + 1}</td>
        <td>${escapeHTML(p.ml || '-')}</td>
        <td>${escapeHTML(p.sku || '-')}</td>
        <td>${escapeHTML(p.produto || '-')}</td>
        <td class="c">${p.qtd || 1}</td>
        <td>${escapeHTML(p.resp || '-')}</td>
        <td>${escapeHTML((STATUS_BADGES[p.status] || ['', p.status])[1])}</td>
        <td class="r">${fmt(p.valor)}</td>
      </tr>`).join('');
    return `
      <tr class="grp">
        <td colspan="9">${formatDateFull(data)} — ${items.length} pedido(s) · ${qtdTotal} item(ns) · ${fmt(soma)}</td>
      </tr>${linhas}`;
  }).join('');

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Pedidos — ${escapeHTML(empresa)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 12px; }
  header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 14px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .sub { font-size: 13px; font-weight: bold; }
  .meta { font-size: 11px; color: #555; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #eee; text-align: left; padding: 6px 8px; border: 1px solid #999; font-size: 11px; }
  tbody td { padding: 5px 8px; border: 1px solid #ccc; }
  tr.grp td { background: #222; color: #fff; font-weight: bold; padding: 6px 8px; }
  td.chk { text-align: center; font-size: 15px; width: 24px; }
  td.c { text-align: center; }
  td.r { text-align: right; white-space: nowrap; }
  tfoot td { padding: 8px; font-weight: bold; border-top: 2px solid #111; font-size: 13px; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  .toolbar { margin-bottom: 14px; }
  .toolbar button { font-size: 13px; padding: 8px 16px; margin-right: 8px; cursor: pointer; }
  @media print { .toolbar { display: none; } body { margin: 0; } }
</style></head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">🖨 Imprimir</button>
    <button onclick="window.close()">Fechar</button>
  </div>
  <header>
    <h1>${escapeHTML(empresa)}</h1>
    <div class="sub">Lista de Pedidos — ${escapeHTML(statusLabel)}</div>
    <div class="meta">Gerado em ${agora} · ${qtdDias || 1} dia(s) · ${list.length} pedido(s) · Total ${fmt(totalGeral)}</div>
  </header>
  <table>
    <thead>
      <tr>
        <th>✓</th><th>#</th><th>Pedido ML</th><th>SKU</th><th>Produto</th>
        <th>Qtd</th><th>Responsável</th><th>Status</th><th>Valor</th>
      </tr>
    </thead>
    <tbody>${corpo}</tbody>
    <tfoot>
      <tr><td colspan="8" class="r">Total geral (${list.length} pedidos)</td><td class="r">${fmt(totalGeral)}</td></tr>
    </tfoot>
  </table>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width=980,height=720');
  if (!w) {
    showToast('Popup bloqueado. Permita popups para imprimir.', 'danger');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}

/* ── Checklist de despacho ───────────────────────────────── */
function toggleCheck(el) {
  el.classList.toggle('done');
  updateChecklistProgress();
}

function resetChecklist() {
  document.querySelectorAll('.check-item').forEach(r => r.classList.remove('done'));
  updateChecklistProgress();
}

function updateChecklistProgress() {
  const all  = document.querySelectorAll('.check-item').length;
  const done = document.querySelectorAll('.check-item.done').length;
  const bar  = document.getElementById('chk-fill');
  const lbl  = document.getElementById('chk-label');
  if (bar) bar.style.width = all > 0 ? (done / all * 100) + '%' : '0%';
  if (lbl) lbl.textContent = `${done} de ${all}`;
}

/* ── Data no topbar ──────────────────────────────────────── */
function initDate() {
  const el = document.getElementById('date-label');
  if (!el) return;
  const opts = { weekday: 'short', day: '2-digit', month: 'short' };
  el.textContent = new Date().toLocaleDateString('pt-BR', opts);
}

/* ── Init ────────────────────────────────────────────────── */
// Carrega os dados e liga o app. Só roda com uma sessão válida.
async function startApp() {
  const ok = await loadDB();     // false = sessão recusada (login reexibido)
  if (ok === false) return;
  applyRecurring();
  renderAll();
  verificarStatusML();
}

document.addEventListener('DOMContentLoaded', () => {
  initDate();
  if (isLoggedIn()) startApp();  // token presente → tenta iniciar (revalida no servidor)
  else showLogin();              // sem token → pede a senha
});
