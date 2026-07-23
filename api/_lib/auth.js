const crypto = require('crypto');

// Segredo para assinar os tokens. Reaproveita a service_role key do Supabase
// (já configurada e secreta no servidor), evitando pedir mais uma variável.
// Pode ser sobrescrito por AUTH_SECRET se quiser um segredo dedicado.
const SECRET = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-secret';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Token = payload.assinatura (HMAC-SHA256). Sem estado no servidor.
function sign() {
  const payload = b64url(JSON.stringify({ exp: Date.now() + TTL_MS }));
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest());
  return payload + '.' + sig;
}

function verify(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest());
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const p = JSON.parse(json);
    return !!p.exp && Date.now() < p.exp;
  } catch { return false; }
}

function tokenFromReq(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

// Retorna true se autenticado; senão responde 401 e retorna false.
function requireAuth(req, res) {
  if (verify(tokenFromReq(req))) return true;
  res.status(401).json({ error: 'Não autorizado.' });
  return false;
}

module.exports = { sign, verify, requireAuth };
