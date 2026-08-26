// ════════════════════════════════════════════════════════════
// Rose Artesanatos · ml.js
// Integração com a API do Mercado Livre via funções serverless (Vercel)
// ════════════════════════════════════════════════════════════

async function fetchBackend(path, options = {}) {
  options.headers = authHeaders(options.headers);
  const res = await fetch('/api' + path, options);
  if (res.status === 401) { onAuthExpired(); throw new Error('Não autorizado'); }
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}

async function conectarML() {
  try {
    const data   = await fetchBackend('/auth/url');
    const popup  = window.open(data.url, 'ml_auth', 'width=640,height=700,top=100,left=100');

    if (!popup || popup.closed) {
      showToast('Popup bloqueado pelo navegador. Permita popups para este site.', 'danger');
      return;
    }

    const onMessage = (e) => {
      if (e.data !== 'ml_connected') return;
      window.removeEventListener('message', onMessage);
      popup.close();
      DB.config.mlConnected = true;
      saveDB();
      renderAll();
      showToast('✅ Mercado Livre conectado com sucesso!', 'success');
    };
    window.addEventListener('message', onMessage);

    // Limpa listener se o popup for fechado manualmente
    const pollClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollClosed);
        window.removeEventListener('message', onMessage);
      }
    }, 1000);
  } catch (err) {
    console.error('[ML] Erro ao conectar:', err);
    showToast('Erro ao conectar com o Mercado Livre. Tente novamente.', 'danger');
  }
}

async function importarML() {
  const btn = document.getElementById('btn-ml-import');
  if (btn) { btn.textContent = '⏳ Importando...'; btn.disabled = true; }

  try {
    // Manda o que o sistema já tem para o servidor devolver só o que falta.
    // Quem manda no que já existe é o sistema, não uma tabela no servidor —
    // assim, se algo se perdeu numa importação anterior, esta traz de volta.
    const jaTenho = [
      ...DB.pedidos.map(p => p.ml).filter(ml => /^ML-\d+$/.test(ml || '')),
      ...(DB.mlIgnorados || []),
    ];

    const data = await fetchBackend('/pedidos/importar', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jaTenho }),
    });

    // Baixa dos cancelamentos primeiro: pedidos que o ML já cancelou saem da
    // operação e têm os lançamentos automáticos estornados, para não seguirem
    // contando como venda nem aparecerem na lista de separação.
    let cancelados = 0, valorEstornado = 0;
    if (Array.isArray(data.cancelados) && data.cancelados.length) {
      const refs = new Set(data.cancelados);
      DB.pedidos
        .filter(p => p.ml && refs.has(p.ml) && p.status !== STATUS_CANCELADO)
        .forEach(p => {
          const r = aplicarCancelamento(p, 'mercado-livre');
          if (r) { cancelados++; valorEstornado += r.valorEstornado; }
        });
    }

    let novos = 0;
    if (Array.isArray(data.pedidos)) {
      const existingMLIds = new Set(DB.pedidos.map(p => p.ml).filter(Boolean));
      data.pedidos
        .filter(p => !existingMLIds.has(p.ml))
        .forEach(p => {
          DB.pedidos.push({ ...p, criadoEm: p.criadoEm || today() });
          novos++;
        });
    }

    if (!novos && !cancelados) {
      // Diz POR QUE não veio nada. "Nenhum pedido novo" sem explicação é o que
      // fazia parecer que a importação simplesmente não funcionava.
      const vistos = Number(data.vistosNoML || 0);
      showToast(vistos
        ? `Tudo em dia — ${vistos} venda(s) no ML e todas já estão no sistema.`
        : 'Nenhuma venda paga encontrada no Mercado Livre agora.');
      return;
    }

    saveDB();
    renderAll();

    const partes = [];
    if (novos)      partes.push(`${novos} pedido(s) importado(s)`);
    if (cancelados) partes.push(`${cancelados} cancelamento(s) aplicado(s)`
      + (valorEstornado > 0 ? ` — ${fmt(valorEstornado)} estornado(s)` : ''));
    showToast('✅ ' + partes.join(' · '), cancelados ? '' : 'success');
  } catch (err) {
    console.error('[ML] Erro ao importar:', err);
    showToast('Erro ao importar pedidos. Verifique a conexão com o backend.', 'danger');
  } finally {
    if (btn) { btn.textContent = '⬇ Importar Pedidos'; btn.disabled = false; }
  }
}

/* ── Sincronização de status dos pedidos ─────────────────── */
// Pergunta ao ML como está CADA pedido que temos em aberto. A importação só
// traz venda nova; um pedido já emitido pode ser cancelado depois — inclusive
// depois de despachado. Sem essa checagem, o pedido continuaria na operação
// (indo pra lista de separação) e contando como venda.
const SYNC_LOTE      = 60;   // ids por requisição (o backend tem o mesmo teto)
const SYNC_MAX_LOTES = 4;    // teto de segurança por rodada

// Pedidos vindos do ML que ainda podem mudar de status, mais urgentes primeiro:
// quem ainda não saiu é o que a equipe vai separar hoje.
function pedidosParaSincronizar() {
  return DB.pedidos
    .filter(p => /^ML-\d+$/.test(p.ml || '') && p.status !== STATUS_CANCELADO)
    .sort((a, b) => {
      const abertoA = a.status !== 'despachado' ? 0 : 1;
      const abertoB = b.status !== 'despachado' ? 0 : 1;
      if (abertoA !== abertoB) return abertoA - abertoB;
      return String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''));
    })
    .slice(0, SYNC_LOTE * SYNC_MAX_LOTES);
}

// silencioso = rodada automática (não avisa quando não há nada novo).
async function sincronizarStatusML({ silencioso = false } = {}) {
  if (!DB.config.mlConnected) {
    if (!silencioso) showToast('Conecte o Mercado Livre antes de verificar os pedidos.', 'danger');
    return 0;
  }

  const alvo = pedidosParaSincronizar();
  if (!alvo.length) {
    if (!silencioso) showToast('Nenhum pedido do Mercado Livre para verificar.');
    return 0;
  }

  const btn = document.getElementById('btn-ml-sync');
  if (btn && !silencioso) { btn.textContent = '⏳ Verificando...'; btn.disabled = true; }

  try {
    const canceladas = new Set();
    let erros = 0;

    for (let i = 0; i < alvo.length; i += SYNC_LOTE) {
      const ids = alvo.slice(i, i + SYNC_LOTE).map(p => p.ml);
      const data = await fetchBackend('/pedidos/status', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids }),
      });
      erros += Number(data.erros || 0);
      (data.statuses || []).forEach(s => { if (s.cancelado) canceladas.add(s.ml); });
    }

    let aplicados = 0, valorEstornado = 0;
    DB.pedidos
      .filter(p => canceladas.has(p.ml) && p.status !== STATUS_CANCELADO)
      .forEach(p => {
        const r = aplicarCancelamento(p, 'mercado-livre');
        if (r) { aplicados++; valorEstornado += r.valorEstornado; }
      });

    if (aplicados) {
      saveDB();
      renderAll();
      showToast(`⊘ ${aplicados} pedido(s) cancelado(s) no Mercado Livre`
        + (valorEstornado > 0 ? ` — ${fmt(valorEstornado)} estornado(s)` : '')
        + '. Saíram da lista de separação.', 'danger');
    } else if (!silencioso) {
      showToast(erros
        ? `Nenhum cancelamento novo (${erros} pedido(s) não puderam ser consultados).`
        : `✅ ${alvo.length} pedido(s) verificado(s) — nenhum cancelamento.`, erros ? 'danger' : 'success');
    }

    return aplicados;
  } catch (err) {
    console.error('[ML] Erro ao sincronizar status:', err);
    if (!silencioso) showToast('Erro ao verificar os pedidos no Mercado Livre.', 'danger');
    return 0;
  } finally {
    if (btn && !silencioso) { btn.textContent = '⟳ Verificar Cancelamentos'; btn.disabled = false; }
  }
}

async function verificarStatusML() {
  try {
    const data = await fetchBackend('/auth/status');
    if (!!data.connected !== DB.config.mlConnected) {
      DB.config.mlConnected = !!data.connected;
      saveDB();
      renderMLBanner();
      renderConfig();
    }
  } catch { /* silencioso — verificação em background */ }
}
