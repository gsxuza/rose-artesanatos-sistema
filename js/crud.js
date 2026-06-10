// ════════════════════════════════════════════════════════════
// Rose Artesanatos · crud.js
// Operações de criação, atualização e remoção de registros
// ════════════════════════════════════════════════════════════

const STATUS_FLOW = ['pendente', 'separando', 'embalado', 'despachado'];

/* ── Pedidos ─────────────────────────────────────────────── */
function salvarPedido() {
  const ml    = gv('np-ml').trim();
  const sku   = gv('np-sku').trim();
  const resp  = gv('np-resp');
  const qtd   = Number(gv('np-qtd')) || 1;
  const valor = Number(gv('np-valor')) || 0;
  const col   = gv('np-coleta');

  if (!ml || !sku) { showToast('Preencha o Nº do pedido e o SKU.', 'danger'); return; }

  const prodNome = DB.estoque.find(e => e.sku === sku)?.nome || sku;
  DB.pedidos.push({
    id: uid(), ml, sku, produto: prodNome,
    qtd, resp, coleta: col, valor,
    status: 'pendente', criadoEm: today(),
  });
  saveDB(); renderAll(); closeModal('modal-pedido');
  ['np-ml','np-sku','np-valor','np-coleta'].forEach(id => setVal(id,''));
  setVal('np-qtd', '1');
  showToast(`Pedido ${ml} cadastrado!`, 'success');
}

function avancarPedido(id) {
  const p   = DB.pedidos.find(x => x.id === id);
  if (!p) return;
  const idx = STATUS_FLOW.indexOf(p.status);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;

  p.status = STATUS_FLOW[idx + 1];

  if (p.status === 'despachado') {
    p.despachadoEm = today();
    processarDespacho(p);
    saveDB(); renderAll();
    showToast(`✅ Despachado! Receita de ${fmt(p.valor)} registrada.`, 'success');
  } else {
    const labels = { separando:'Em Separação', embalado:'Embalado' };
    saveDB(); renderAll();
    showToast(`Pedido ${p.ml} → ${labels[p.status] || p.status}`);
  }
}

function removerPedido(id) {
  if (!confirm('Remover este pedido?')) return;
  DB.pedidos = DB.pedidos.filter(p => p.id !== id);
  saveDB(); renderAll();
  showToast('Pedido removido.', 'danger');
}

/* ── Estoque ─────────────────────────────────────────────── */
function salvarSKU() {
  const sku  = gv('sk-sku').trim();
  const nome = gv('sk-nome').trim();
  if (!sku || !nome) { showToast('Preencha SKU e nome.', 'danger'); return; }
  if (DB.estoque.find(e => e.sku === sku)) { showToast('SKU já cadastrado!', 'danger'); return; }

  DB.estoque.push({
    sku, nome,
    local: gv('sk-local').trim(),
    custo: Number(gv('sk-custo')) || 0,
    qtd:   Number(gv('sk-qtd'))  || 0,
    min:   Number(gv('sk-min'))  || 5,
  });
  saveDB(); renderAll(); closeModal('modal-sku');
  ['sk-sku','sk-nome','sk-local','sk-custo'].forEach(id => setVal(id,''));
  setVal('sk-qtd','0'); setVal('sk-min','5');
  showToast(`SKU ${sku} cadastrado!`, 'success');
}

function ajustarEstoque(sku) {
  const item = DB.estoque.find(i => i.sku === sku);
  if (!item) return;
  const novo = prompt(`Nova quantidade para "${item.nome}":`, item.qtd);
  if (novo === null) return;
  if (isNaN(Number(novo))) { showToast('Valor inválido.', 'danger'); return; }
  item.qtd = Number(novo);
  saveDB(); renderAll();
  showToast('Estoque atualizado!', 'success');
}

function removerSKU(sku) {
  if (!confirm(`Remover ${sku} do estoque?`)) return;
  DB.estoque = DB.estoque.filter(i => i.sku !== sku);
  saveDB(); renderAll();
  showToast('SKU removido.', 'danger');
}

/* ── Despesas ────────────────────────────────────────────── */
function salvarDespesa() {
  const desc  = gv('nd-desc').trim();
  const valor = Number(gv('nd-valor'));
  const data  = gv('nd-data');
  if (!desc || !valor || !data) { showToast('Preencha todos os campos obrigatórios.', 'danger'); return; }

  const isRec = document.getElementById('nd-recorrente')?.checked;

  DB.despesas.push({
    id: uid(), descricao: desc, valor,
    categoria: gv('nd-cat'),
    data, status: gv('nd-status'),
    obs: gv('nd-obs').trim(),
    auto: false,
  });

  if (isRec) {
    DB.despesasRecorrentes.push({
      id: uid(), nome: desc, valor, categoria: gv('nd-cat'),
    });
  }

  saveDB(); renderAll(); closeModal('modal-despesa');
  ['nd-desc','nd-valor','nd-obs'].forEach(id => setVal(id,''));
  const chk = document.getElementById('nd-recorrente');
  if (chk) chk.checked = false;

  showToast(isRec ? 'Despesa salva e marcada como recorrente!' : 'Despesa registrada!', 'success');
}

function removerDespesa(id) {
  if (!confirm('Remover esta despesa?')) return;
  DB.despesas = DB.despesas.filter(d => d.id !== id);
  saveDB(); renderAll();
  showToast('Despesa removida.', 'danger');
}

/* ── Despesas Recorrentes ────────────────────────────────── */
function salvarRecorrente() {
  const nome  = gv('nr-nome').trim();
  const valor = Number(gv('nr-valor'));
  if (!nome || !valor) { showToast('Preencha nome e valor.', 'danger'); return; }

  DB.despesasRecorrentes.push({
    id: uid(), nome, valor, categoria: gv('nr-cat'),
  });
  saveDB(); renderAll(); closeModal('modal-recorrente');
  ['nr-nome','nr-valor'].forEach(id => setVal(id,''));
  showToast('Despesa recorrente adicionada! Aplicada automaticamente todo dia 1.', 'success');
}

function removerRecorrente(id) {
  if (!confirm('Remover esta despesa recorrente?')) return;
  DB.despesasRecorrentes = DB.despesasRecorrentes.filter(t => t.id !== id);
  saveDB(); renderAll();
  showToast('Recorrente removida.', 'danger');
}

/* ── Receitas Manuais ────────────────────────────────────── */
function salvarReceitaManual() {
  const desc  = gv('rm-desc').trim();
  const valor = Number(gv('rm-valor'));
  const data  = gv('rm-data');
  if (!desc || !valor || !data) { showToast('Preencha todos os campos.', 'danger'); return; }

  DB.receitas.push({ id: uid(), descricao: desc, valor, data, origem: 'manual' });
  saveDB(); renderAll(); closeModal('modal-receita');
  ['rm-desc','rm-valor'].forEach(id => setVal(id,''));
  showToast('Receita registrada!', 'success');
}

function removerReceita(id) {
  if (!confirm('Remover esta receita?')) return;
  DB.receitas = DB.receitas.filter(r => r.id !== id);
  saveDB(); renderAll();
  showToast('Receita removida.', 'danger');
}

/* ── Envios Full ─────────────────────────────────────────── */
function salvarFull() {
  const id = gv('ef-id').trim();
  if (!id) { showToast('Preencha o ID do envio.', 'danger'); return; }
  DB.enviosFull.unshift({
    id, data: gv('ef-data'),
    volumes: Number(gv('ef-vol')) || 1,
    status: gv('ef-status'),
  });
  saveDB(); renderAll(); closeModal('modal-full');
  setVal('ef-id','');
  showToast('Envio Full cadastrado!', 'success');
}

/* ── Horários ────────────────────────────────────────────── */
function salvarHorarios() {
  DB.config.hCorte    = gv('hm-corte');
  DB.config.hDespacho = gv('hm-despacho');
  saveDB(); renderAll(); closeModal('modal-horarios');
  showToast('Horários atualizados!', 'success');
}

/* ── Configurações ───────────────────────────────────────── */
function salvarConfig() {
  DB.config.backendUrl     = gv('cfg-backend-url').trim().replace(/\/$/, '');
  DB.config.taxaML         = Number(gv('cfg-taxa-ml'))   || 12;
  DB.config.custoEmbalagem = Number(gv('cfg-custo-emb')) || 0;
  DB.config.nomeEmpresa    = gv('cfg-nome').trim() || 'Rose Artesanatos';
  DB.config.hCorte         = gv('cfg-h-corte');
  DB.config.hDespacho      = gv('cfg-h-despacho');
  saveDB(); renderAll();
  showToast('Configurações salvas!', 'success');
}

/* ── Helper input ────────────────────────────────────────── */
function gv(id) {
  const e = document.getElementById(id);
  return e ? e.value : '';
}
