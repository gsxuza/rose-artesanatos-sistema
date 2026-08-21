// ════════════════════════════════════════════════════════════
// Rose Artesanatos · finance.js
// Cálculos financeiros e automação de lançamentos
// ════════════════════════════════════════════════════════════

/* ── Receitas ────────────────────────────────────────────── */
function getReceitasMes(ym) {
  return DB.receitas
    .filter(r => monthKey(r.data) === ym)
    .reduce((s, r) => s + Number(r.valor || 0), 0);
}

/* ── Despesas ────────────────────────────────────────────── */
function getDespesasMes(ym) {
  return DB.despesas
    .filter(d => monthKey(d.data) === ym)
    .reduce((s, d) => s + Number(d.valor || 0), 0);
}

function getLucroMes(ym) {
  return getReceitasMes(ym) - getDespesasMes(ym);
}

function getMargemMes(ym) {
  const r = getReceitasMes(ym);
  return r ? (getLucroMes(ym) / r) * 100 : 0;
}

function getTicketMedio(ym) {
  const desp = DB.pedidos.filter(p =>
    p.status === 'despachado' &&
    (!ym || monthKey(p.despachadoEm || '') === ym)
  );
  if (!desp.length) return 0;
  return desp.reduce((s, p) => s + Number(p.valor || 0), 0) / desp.length;
}

/* ── Série temporal ──────────────────────────────────────── */
function getLast6Months() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    return {
      ym,
      label:   monthLabel(ym),
      receita: getReceitasMes(ym),
      despesa: getDespesasMes(ym),
    };
  });
}

/* ── Despesas por categoria ──────────────────────────────── */
function getDespesasByCategory(ym) {
  const cats = {};
  DB.despesas
    .filter(d => !ym || monthKey(d.data) === ym)
    .forEach(d => {
      const c = d.categoria || 'Outros';
      cats[c] = (cats[c] || 0) + Number(d.valor || 0);
    });
  return Object.entries(cats).sort((a, b) => b[1] - a[1]);
}

/* ── Status de estoque ───────────────────────────────────── */
function getEstoqueStatus(item) {
  if (item.qtd <= 0) return 'critico';
  if (item.qtd < item.min) return 'baixo';
  return 'ok';
}

/* ── Alertas automáticos ─────────────────────────────────── */
function getAlerts() {
  const ym = nowMK();
  const alerts = [];
  const receita = getReceitasMes(ym);
  const despesa = getDespesasMes(ym);

  if (despesa > receita && receita > 0)
    alerts.push({ type: 'danger', icon: '⚠️',
      msg: `Despesas <b>(${fmt(despesa)})</b> superam receitas <b>(${fmt(receita)})</b> este mês!` });

  DB.estoque.filter(i => getEstoqueStatus(i) === 'critico')
    .forEach(i => alerts.push({ type: 'danger', icon: '📦',
      msg: `Estoque crítico: <b>${i.nome}</b> — ${i.qtd} unidade(s) restante(s)` }));

  DB.estoque.filter(i => getEstoqueStatus(i) === 'baixo')
    .forEach(i => alerts.push({ type: 'warning', icon: '⚡',
      msg: `Estoque baixo: <b>${i.nome}</b> — ${i.qtd} unid. (mínimo: ${i.min})` }));

  const pendentes = DB.despesas.filter(d => d.status === 'pendente' && monthKey(d.data) === ym);
  if (pendentes.length)
    alerts.push({ type: 'warning', icon: '💳',
      msg: `${pendentes.length} despesa(s) pendente(s) de pagamento neste mês` });

  // Cancelamentos do mês: já foram estornados do financeiro, mas a operação
  // precisa enxergar o volume — é dinheiro que se esperava e não entrou.
  const cancelados = DB.pedidos.filter(p =>
    p.status === STATUS_CANCELADO && monthKey(p.canceladoEm || '') === ym);
  if (cancelados.length) {
    const perdido = cancelados.reduce((s, p) => s + Number(p.valor || 0), 0);
    alerts.push({ type: 'warning', icon: '⊘',
      msg: `${cancelados.length} pedido(s) cancelado(s) neste mês — <b>${fmt(perdido)}</b> que deixaram de entrar` });
  }

  return alerts;
}

/* ── Automação: despesas recorrentes ─────────────────────── */
function applyRecurring() {
  const key = nowMK();
  // A guarda "já apliquei este mês" agora vive no estado compartilhado, para
  // que apenas o primeiro usuário do mês aplique as recorrentes (e não cada
  // navegador uma vez, como no modelo antigo de localStorage).
  DB.appliedRecurring = DB.appliedRecurring || [];
  if (DB.appliedRecurring.includes(key)) return;
  if (!DB.despesasRecorrentes?.length) {
    DB.appliedRecurring.push(key);
    saveDB();
    return;
  }

  let applied = 0;
  DB.despesasRecorrentes.forEach(t => {
    const exists = DB.despesas.some(d => d.templateId === t.id && monthKey(d.data) === key);
    if (!exists) {
      DB.despesas.push({
        id: uid(), templateId: t.id,
        descricao: t.nome + ' (automático)',
        valor: t.valor, categoria: t.categoria,
        data: key + '-01', status: 'pendente', auto: true,
      });
      applied++;
    }
  });

  DB.appliedRecurring.push(key);
  saveDB();
  if (applied > 0) {
    setTimeout(() =>
      showToast(`⚡ ${applied} despesa(s) recorrente(s) aplicada(s) automaticamente!`, 'success'), 800);
  }
}

/* ── Automação: despacho → receita + despesas ────────────── */
function processarDespacho(pedido) {
  // Receita automática
  DB.receitas.push({
    id: uid(),
    descricao: 'Venda: ' + (pedido.produto || pedido.sku),
    subDesc: pedido.ml,
    valor: pedido.valor,
    data: today(),
    origem: 'auto',
    pedidoId: pedido.id,
  });

  // Taxa ML automática
  const taxa = Number(DB.config.taxaML || 12);
  if (taxa > 0 && pedido.valor > 0) {
    DB.despesas.push({
      id: uid(),
      descricao: 'Taxa Mercado Livre — ' + pedido.ml,
      valor: parseFloat((pedido.valor * taxa / 100).toFixed(2)),
      categoria: 'Taxas ML',
      data: today(), status: 'pago', auto: true, pedidoId: pedido.id,
    });
  }

  // Custo de embalagem automático
  const custoEmb = Number(DB.config.custoEmbalagem || 0);
  if (custoEmb > 0) {
    DB.despesas.push({
      id: uid(),
      descricao: 'Embalagem — ' + pedido.ml,
      valor: parseFloat((custoEmb * (pedido.qtd || 1)).toFixed(2)),
      categoria: 'Embalagens',
      data: today(), status: 'pago', auto: true, pedidoId: pedido.id,
    });
  }
}
