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
  config: {
    backendUrl:     '',
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

/* ── Persistência ────────────────────────────────────────── */
function loadDB() {
  try {
    const saved = localStorage.getItem('rose_v2_db');
    if (saved) {
      const p = JSON.parse(saved);
      DB = { ...DEFAULT_DB, ...p,
        config: { ...DEFAULT_DB.config, ...(p.config || {}) } };
    } else {
      DB = JSON.parse(JSON.stringify(DEFAULT_DB));
    }
  } catch (e) {
    console.warn('[DB] Erro ao carregar:', e);
    DB = JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

function saveDB() {
  try { localStorage.setItem('rose_v2_db', JSON.stringify(DB)); }
  catch (e) { console.warn('[DB] Erro ao salvar:', e); }
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
