// ════════════════════════════════════════════════════════════
// Rose Artesanatos · crud.js
// Operações de criação, atualização e remoção de registros
// ════════════════════════════════════════════════════════════

/* ── Pedidos ─────────────────────────────────────────────── */
function salvarPedido() {
  const ml    = getInputValue('np-ml').trim();
  const sku   = getInputValue('np-sku').trim();
  const resp  = getInputValue('np-resp');
  const qtd   = Math.max(1, parseInt(getInputValue('np-qtd'), 10) || 1);
  const valor = parseMoney(getInputValue('np-valor'));
  const col   = getInputValue('np-coleta');

  if (!ml || !sku) { showToast('Preencha o Nº do pedido e o SKU.', 'danger'); return; }

  const prodNome = DB.estoque.find(e => e.sku === sku)?.nome || sku;
  DB.pedidos.push({
    id: uid(), ml, sku, produto: prodNome,
    qtd, resp, coleta: col, valor,
    status: STATUS_FLOW[0], criadoEm: today(),
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
  const sku  = getInputValue('sk-sku').trim().toUpperCase();
  const nome = getInputValue('sk-nome').trim();
  if (!sku || !nome) { showToast('Preencha SKU e nome.', 'danger'); return; }
  if (DB.estoque.find(e => e.sku === sku)) { showToast('SKU já cadastrado!', 'danger'); return; }

  const qtd = parseInt(getInputValue('sk-qtd'), 10) || 0;
  const min = parseInt(getInputValue('sk-min'), 10) || 5;
  DB.estoque.push({
    sku, nome,
    local: getInputValue('sk-local').trim(),
    custo: parseMoney(getInputValue('sk-custo')),
    qtd:   Math.max(0, qtd),
    min:   Math.max(0, min),
  });
  saveDB(); renderAll(); closeModal('modal-sku');
  ['sk-sku','sk-nome','sk-local','sk-custo'].forEach(id => setVal(id,''));
  setVal('sk-qtd','0'); setVal('sk-min','5');
  showToast(`SKU ${sku} cadastrado!`, 'success');
}

function ajustarEstoque(sku) {
  const item = DB.estoque.find(i => i.sku === sku);
  if (!item) return;
  const novo = prompt(`Nova quantidade para "${item.nome}" (atual: ${item.qtd}):`, item.qtd);
  if (novo === null) return;
  const n = parseInt(novo, 10);
  if (!Number.isFinite(n) || n < 0) { showToast('Quantidade inválida. Use um número inteiro ≥ 0.', 'danger'); return; }
  item.qtd = n;
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
  const desc  = getInputValue('nd-desc').trim();
  const valor = parseMoney(getInputValue('nd-valor'));
  const data  = getInputValue('nd-data');
  if (!desc) { showToast('Informe a descrição da despesa.', 'danger'); return; }
  if (valor <= 0) { showToast('Informe um valor maior que zero.', 'danger'); return; }
  if (!data) { showToast('Informe a data da despesa.', 'danger'); return; }

  const isRec = document.getElementById('nd-recorrente')?.checked;
  const cat   = getInputValue('nd-cat');

  DB.despesas.push({
    id: uid(), descricao: desc, valor,
    categoria: cat,
    data, status: getInputValue('nd-status'),
    obs: getInputValue('nd-obs').trim(),
    auto: false,
  });

  if (isRec) {
    DB.despesasRecorrentes.push({ id: uid(), nome: desc, valor, categoria: cat });
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
  const nome  = getInputValue('nr-nome').trim();
  const valor = parseMoney(getInputValue('nr-valor'));
  if (!nome) { showToast('Informe o nome da despesa recorrente.', 'danger'); return; }
  if (valor <= 0) { showToast('Informe um valor maior que zero.', 'danger'); return; }

  DB.despesasRecorrentes.push({
    id: uid(), nome, valor, categoria: getInputValue('nr-cat'),
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
  const desc  = getInputValue('rm-desc').trim();
  const valor = parseMoney(getInputValue('rm-valor'));
  const data  = getInputValue('rm-data');
  if (!desc) { showToast('Informe a descrição da receita.', 'danger'); return; }
  if (valor <= 0) { showToast('Informe um valor maior que zero.', 'danger'); return; }
  if (!data) { showToast('Informe a data da receita.', 'danger'); return; }

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
  const id = getInputValue('ef-id').trim();
  if (!id) { showToast('Preencha o ID do envio.', 'danger'); return; }
  if (DB.enviosFull.find(e => e.id === id)) { showToast('ID de envio já cadastrado!', 'danger'); return; }
  DB.enviosFull.unshift({
    id, data: getInputValue('ef-data'),
    volumes: Math.max(1, parseInt(getInputValue('ef-vol'), 10) || 1),
    status: getInputValue('ef-status'),
  });
  saveDB(); renderAll(); closeModal('modal-full');
  setVal('ef-id','');
  showToast('Envio Full cadastrado!', 'success');
}

/* ── Horários ────────────────────────────────────────────── */
function salvarHorarios() {
  DB.config.hCorte    = getInputValue('hm-corte');
  DB.config.hDespacho = getInputValue('hm-despacho');
  saveDB(); renderAll(); closeModal('modal-horarios');
  showToast('Horários atualizados!', 'success');
}

/* ── Configurações ───────────────────────────────────────── */
function salvarConfig() {
  const taxa = parseMoney(getInputValue('cfg-taxa-ml'));
  const emb  = parseMoney(getInputValue('cfg-custo-emb'));
  DB.config.taxaML         = taxa > 0 && taxa <= 100 ? taxa : 12;
  DB.config.custoEmbalagem = emb >= 0 ? emb : 0;
  DB.config.nomeEmpresa    = getInputValue('cfg-nome').trim() || 'Rose Artesanatos';
  DB.config.hCorte         = getInputValue('cfg-h-corte');
  DB.config.hDespacho      = getInputValue('cfg-h-despacho');
  saveDB(); renderAll();
  showToast('Configurações salvas!', 'success');
}

/* ── Helpers de input ────────────────────────────────────── */
// Alias curto mantido para compatibilidade com chamadas inline no HTML
const gv = getInputValue;

function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
