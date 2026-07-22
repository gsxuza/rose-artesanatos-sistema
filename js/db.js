// ════════════════════════════════════════════════════════════
// Rose Artesanatos · db.js
// Estado global, persistência localStorage e helpers globais
// ════════════════════════════════════════════════════════════

const DEFAULT_DB = {
  pedidos:             [],
  estoque:             [],
  enviosFull:          [],
  despesas:            [],
  despesasRecorrentes: [],
  receitas:            [],
  appliedRecurring:    [],  // meses (AAAA-MM) em que as recorrentes já foram aplicadas
  config: {
    mlConnected:    false,
    taxaML:         12,
    custoEmbalagem: 3.50,
    hCorte:         '08:00',
    hDespacho:      '14:00',
    nomeEmpresa:    'Rose Artesanatos',
  },
};

let DB = {};

/* ── Helpers globais ─────────────────────────────────────── */
const uid      = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today    = () => new Date().toISOString().split('T')[0];
const nowMK    = () => monthKey(today());
const monthKey = (d) => d ? String(d).substring(0, 7) : '';
const clamp    = (n, mn, mx) => Math.min(Math.max(n, mn), mx);

// Previne XSS ao inserir dados do usuário em innerHTML
const escapeHTML = (() => {
  const div = document.createElement('div');
  return (str) => {
    div.textContent = String(str ?? '');
    return div.innerHTML;
  };
})();

// Converte string de input em número financeiro com segurança
const parseMoney = (v) => {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const fmt = (v) =>
  'R$\u00A0' + Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

const fmtK = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1000)
    return 'R$' + (n / 1000).toLocaleString('pt-BR', {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    }) + 'k';
  return 'R$' + n.toLocaleString('pt-BR', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
};

const monthLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const ms = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return (ms[Number(m) - 1] || '?') + '/' + y.slice(2);
};

/* ── Persistência (Supabase = fonte compartilhada · localStorage = cache) ──
   O estado do sistema vive numa única linha no Supabase (via /api/state), então
   todos os usuários enxergam os mesmos dados. O localStorage é só um cache local
   para resposta instantânea e leitura offline. */
const STATE_URL = '/api/state';
const CACHE_KEY = 'rose_v2_db';

let _saveTimer     = null;   // debounce das gravações
let _lastMutation  = 0;      // timestamp da última edição local (evita clobber no refresh)
let _lastUpdatedAt = null;   // updated_at do estado que já temos aplicado

function mergeDefaults(obj) {
  return {
    ...DEFAULT_DB,
    ...(obj || {}),
    config: { ...DEFAULT_DB.config, ...((obj && obj.config) || {}) },
  };
}

function readCache() {
  try { const s = localStorage.getItem(CACHE_KEY); return s ? JSON.parse(s) : null; }
  catch { return null; }
}

function writeCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(DB)); }
  catch (e) { console.warn('[DB] Erro ao gravar cache local:', e); }
}

function cacheHasData(c) {
  return !!c && (
    (c.pedidos && c.pedidos.length) ||
    (c.estoque && c.estoque.length) ||
    (c.despesas && c.despesas.length) ||
    (c.receitas && c.receitas.length) ||
    (c.enviosFull && c.enviosFull.length) ||
    (c.despesasRecorrentes && c.despesasRecorrentes.length) ||
    c.config
  );
}

async function loadDB() {
  let remote = null, remoteUpdatedAt = null;
  try {
    const res = await fetch(STATE_URL);
    if (res.ok) {
      const j = await res.json();
      remote = j.data;
      remoteUpdatedAt = j.updated_at;
    }
  } catch (e) {
    console.warn('[DB] Sem conexão ao carregar; usando cache local.', e);
  }

  if (remote && Object.keys(remote).length) {
    DB = mergeDefaults(remote);
    _lastUpdatedAt = remoteUpdatedAt;
    writeCache();
    return;
  }

  // Nuvem vazia: primeira carga após a migração. Se este aparelho tiver dados
  // locais (do modelo antigo), sobe-os para a nuvem como estado inicial.
  const cache = readCache();
  if (cacheHasData(cache)) {
    DB = mergeDefaults(cache);
    await persistNow();
    return;
  }

  DB = JSON.parse(JSON.stringify(DEFAULT_DB));
}

function saveDB() {
  writeCache();                  // cache local imediato
  _lastMutation = Date.now();
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(persistNow, 400);   // debounce da gravação na nuvem
}

async function persistNow() {
  try {
    const res = await fetch(STATE_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(DB),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    _lastUpdatedAt = j.updated_at || _lastUpdatedAt;
  } catch (e) {
    console.error('[DB] Falha ao sincronizar com a nuvem:', e);
    if (typeof showToast === 'function')
      showToast('Sem conexão — alterações salvas neste aparelho; sincronizo quando voltar.', 'danger');
  }
}

// Busca o estado mais recente da nuvem e re-renderiza se outro usuário mudou algo.
async function refreshDB() {
  if (document.querySelector('.modal-backdrop.open')) return;   // não interrompe edição em modal
  if (Date.now() - _lastMutation < 4000) return;                // acabou de editar localmente
  const ae = document.activeElement;
  if (ae && ['INPUT', 'SELECT', 'TEXTAREA'].includes(ae.tagName)) return;  // digitando

  try {
    const res = await fetch(STATE_URL);
    if (!res.ok) return;
    const j = await res.json();
    if (!j.data || !j.updated_at) return;
    if (j.updated_at === _lastUpdatedAt) return;   // nada mudou desde a última vez
    _lastUpdatedAt = j.updated_at;
    DB = mergeDefaults(j.data);
    writeCache();
    if (typeof renderAll === 'function') renderAll();
  } catch { /* silencioso */ }
}

if (typeof window !== 'undefined') {
  setInterval(refreshDB, 25000);
  window.addEventListener('focus', refreshDB);
}

function exportarDados() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rose-backup-${today()}.json`;
  a.click();
  showToast('Backup exportado com sucesso!', 'success');
}

function limparDados() {
  if (!confirm('ATENÇÃO: Todos os dados serão apagados permanentemente.\n\nDeseja continuar?')) return;
  DB = JSON.parse(JSON.stringify(DEFAULT_DB));
  saveDB();
  renderAll();
  showToast('Dados limpos.', 'danger');
}
