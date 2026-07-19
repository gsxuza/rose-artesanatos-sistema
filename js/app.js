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
document.addEventListener('DOMContentLoaded', () => {
  loadDB();
  applyRecurring();
  initDate();
  renderAll();
  verificarStatusML();
});
