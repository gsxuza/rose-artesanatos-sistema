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
    const data = await fetchBackend('/pedidos/importar', { method: 'POST' });

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
      showToast('Tudo em dia — nenhuma venda nova nem cancelamento no ML.');
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
