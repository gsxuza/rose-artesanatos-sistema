// ════════════════════════════════════════════════════════════
// Rose Artesanatos · ml.js
// Integração com a API do Mercado Livre via backend Railway
// ════════════════════════════════════════════════════════════

async function conectarML() {
  if (!DB.config.backendUrl) {
    showToast('Configure e salve a URL do backend primeiro!', 'danger'); return;
  }
  try {
    const res  = await fetch(DB.config.backendUrl + '/auth/url');
    const data = await res.json();
    const popup = window.open(data.url, 'ml_auth', 'width=640,height=700,top=100,left=100');

    window.addEventListener('message', async (e) => {
      if (e.data === 'ml_connected') {
        popup?.close();
        DB.config.mlConnected = true;
        saveDB(); renderAll();
        showToast('✅ Mercado Livre conectado com sucesso!', 'success');
      }
    }, { once: true });
  } catch {
    showToast('Erro ao conectar com o backend. Verifique a URL.', 'danger');
  }
}

async function importarML() {
  if (!DB.config.backendUrl) {
    showToast('Configure o backend primeiro!', 'danger'); return;
  }

  const btn = document.getElementById('btn-import-ml');
  if (btn) { btn.textContent = '⏳ Importando...'; btn.disabled = true; }

  try {
    const res  = await fetch(DB.config.backendUrl + '/pedidos/importar', { method: 'POST' });
    const data = await res.json();

    if (data.error) { showToast('Erro: ' + data.error, 'danger'); return; }
    if (data.importados === 0) { showToast('Nenhum pedido novo encontrado no ML.'); return; }

    // Mescla com pedidos locais sem duplicar
    if (Array.isArray(data.pedidos)) {
      data.pedidos.forEach(p => {
        if (!DB.pedidos.find(x => x.ml === p.ml || x.id === p.id)) {
          DB.pedidos.push({ ...p, criadoEm: p.criadoEm || today() });
        }
      });
    }

    saveDB(); renderAll();
    showToast(`✅ ${data.importados} pedido(s) importado(s) do ML!`, 'success');
  } catch {
    showToast('Erro ao importar. Verifique a conexão com o backend.', 'danger');
  } finally {
    if (btn) { btn.textContent = '⬇ Importar Pedidos'; btn.disabled = false; }
  }
}

async function verificarStatusML() {
  if (!DB.config.backendUrl) return;
  try {
    const res  = await fetch(DB.config.backendUrl + '/auth/status');
    const data = await res.json();
    if (data.connected !== DB.config.mlConnected) {
      DB.config.mlConnected = !!data.connected;
      saveDB(); renderMLBanner(); renderConfig();
    }
  } catch { /* silencioso */ }
}
