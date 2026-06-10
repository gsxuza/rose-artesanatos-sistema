// ════════════════════════════════════════════════════════════
// Rose Artesanatos · backend/server.js
// API Node.js — integração Mercado Livre + persistência JSON
// Deploy: Railway (railway.app)
// ════════════════════════════════════════════════════════════

const express = require('express');
const axios   = require('axios');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// ── Config via variáveis de ambiente ─────────────────────
const ML_APP_ID   = process.env.ML_APP_ID   || '';
const ML_SECRET   = process.env.ML_SECRET   || '';
const ML_REDIRECT = process.env.ML_REDIRECT || 'http://localhost:3001/auth/callback';
const PORT        = process.env.PORT        || 3001;
const DB_FILE     = path.join(__dirname, 'data', 'db.json');

// ── Banco de dados em arquivo JSON ────────────────────────
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return { tokens: null, pedidos: [], estoque: [], vendas: [] };
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch { return { tokens: null, pedidos: [], estoque: [], vendas: [] }; }
}

function writeDB(data) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ── Gerenciamento de token ML ─────────────────────────────
async function getValidToken(db) {
  if (!db.tokens) return null;
  if (Date.now() < db.tokens.expires_at - 60_000) return db.tokens.access_token;

  const res = await axios.post('https://api.mercadolibre.com/oauth/token', {
    grant_type: 'refresh_token',
    client_id:  ML_APP_ID,
    client_secret: ML_SECRET,
    refresh_token: db.tokens.refresh_token,
  });

  db.tokens = {
    access_token:  res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_at:    Date.now() + res.data.expires_in * 1000,
  };
  writeDB(db);
  return db.tokens.access_token;
}

async function mlGet(endpoint, token) {
  const res = await axios.get(`https://api.mercadolibre.com${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

// ── Auth ──────────────────────────────────────────────────
app.get('/auth/url', (_req, res) => {
  const url = `https://auth.mercadolivre.com.br/authorization?response_type=code`
    + `&client_id=${ML_APP_ID}&redirect_uri=${encodeURIComponent(ML_REDIRECT)}`;
  res.json({ url });
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Código de autorização ausente.');

  try {
    const r = await axios.post('https://api.mercadolibre.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id:  ML_APP_ID,
      client_secret: ML_SECRET,
      code,
      redirect_uri: ML_REDIRECT,
    });

    const db = readDB();
    db.tokens = {
      access_token:  r.data.access_token,
      refresh_token: r.data.refresh_token,
      expires_at:    Date.now() + r.data.expires_in * 1000,
    };
    writeDB(db);

    res.send(`<script>
      window.opener && window.opener.postMessage('ml_connected', '*');
      setTimeout(() => window.close(), 1000);
    </script>
    <p style="font-family:sans-serif;text-align:center;padding:40px">
      ✅ Conectado! Esta janela fechará automaticamente.
    </p>`);
  } catch (err) {
    console.error('[ML] Erro no callback:', err.response?.data || err.message);
    res.status(500).send('Erro ao autenticar. Verifique as credenciais no Railway.');
  }
});

app.get('/auth/status', (req, res) => {
  const db = readDB();
  res.json({ connected: !!db.tokens });
});

// ── Pedidos ───────────────────────────────────────────────
app.post('/pedidos/importar', async (req, res) => {
  const db    = readDB();
  const token = await getValidToken(db);
  if (!token) return res.status(401).json({ error: 'Não autenticado no ML.' });

  try {
    const me     = await mlGet('/users/me', token);
    const search = await mlGet(`/orders/search?seller=${me.id}&order.status=paid&sort=date_desc`, token);
    const orders = search.results || [];
    let importados = 0;

    for (const order of orders) {
      if (db.pedidos.find(p => p.ml_id === String(order.id))) continue;
      const item = order.order_items?.[0];
      db.pedidos.unshift({
        id:         String(order.id) + '_ml',
        ml_id:      String(order.id),
        ml:         `ML-${order.id}`,
        sku:        item?.item?.seller_sku || item?.item?.id || '-',
        produto:    item?.item?.title || 'Produto',
        qtd:        item?.quantity || 1,
        resp:       'Daniel',
        valor:      order.total_amount || 0,
        status:     'pendente',
        criadoEm:   order.date_created?.split('T')[0] || new Date().toISOString().split('T')[0],
      });
      importados++;
    }

    writeDB(db);
    res.json({ importados, total: db.pedidos.length, pedidos: db.pedidos.slice(0, importados) });
  } catch (err) {
    console.error('[ML] Erro ao importar:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erro ao buscar pedidos no ML.' });
  }
});

app.get('/pedidos',          (req, res) => res.json(readDB().pedidos));
app.post('/pedidos',         (req, res) => {
  const db = readDB(); db.pedidos.unshift(req.body); writeDB(db); res.json(req.body);
});
app.patch('/pedidos/:id/status', async (req, res) => {
  const db = readDB();
  const p  = db.pedidos.find(x => String(x.id) === req.params.id);
  if (!p) return res.status(404).json({ error: 'Não encontrado.' });
  p.status = req.body.status;
  writeDB(db);

  // Notifica ML se despachado
  if (p.status === 'despachado' && p.ml_id) {
    try {
      const token = await getValidToken(db);
      if (token) {
        const order = await mlGet(`/orders/${p.ml_id}`, token);
        const shipId = order.shipping?.id;
        if (shipId) {
          await axios.put(`https://api.mercadolibre.com/shipments/${shipId}`,
            { status: 'shipped' }, { headers: { Authorization: `Bearer ${token}` } });
        }
      }
    } catch (e) { console.warn('[ML] Aviso shipment:', e.message); }
  }
  res.json(p);
});
app.delete('/pedidos/:id', (req, res) => {
  const db = readDB(); db.pedidos = db.pedidos.filter(p => String(p.id) !== req.params.id);
  writeDB(db); res.json({ ok: true });
});

// ── Estoque ───────────────────────────────────────────────
app.get('/estoque',            (req, res) => res.json(readDB().estoque));
app.post('/estoque',           (req, res) => {
  const db = readDB(); db.estoque.push(req.body); writeDB(db); res.json(req.body);
});
app.patch('/estoque/:sku',     (req, res) => {
  const db = readDB(); const i = db.estoque.find(x => x.sku === req.params.sku);
  if (!i) return res.status(404).json({ error: 'SKU não encontrado.' });
  Object.assign(i, req.body); writeDB(db); res.json(i);
});
app.delete('/estoque/:sku',    (req, res) => {
  const db = readDB(); db.estoque = db.estoque.filter(x => x.sku !== req.params.sku);
  writeDB(db); res.json({ ok: true });
});

// ── Health ────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ ok: true, ts: new Date().toISOString(), ml: !!readDB().tokens })
);

app.listen(PORT, () =>
  console.log(`🌹 Rose Artesanatos Backend · porta ${PORT}`)
);
