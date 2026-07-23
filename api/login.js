const crypto = require('crypto');
const { sign } = require('./_lib/auth');

const APP_PASSWORD = process.env.APP_PASSWORD || '';

// POST { password } → { token } se a senha bater com APP_PASSWORD.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!APP_PASSWORD) return res.status(500).json({ error: 'Senha não configurada no servidor.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const pass = String((body && body.password) || '');

  // Comparação em tempo constante (evita timing attack).
  const a = Buffer.from(pass), b = Buffer.from(APP_PASSWORD);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return res.status(401).json({ error: 'Senha incorreta.' });

  return res.status(200).json({ token: sign() });
};
