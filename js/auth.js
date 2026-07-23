// ════════════════════════════════════════════════════════════
// Rose Artesanatos · auth.js
// Login com senha compartilhada. O token é validado no servidor e
// acompanha todas as chamadas às rotas de dados protegidas.
// ════════════════════════════════════════════════════════════

const AUTH_KEY = 'rose_auth_token';

function getToken()      { try { return localStorage.getItem(AUTH_KEY) || ''; } catch { return ''; } }
function setToken(t)     { try { localStorage.setItem(AUTH_KEY, t); } catch {} }
function clearToken()    { try { localStorage.removeItem(AUTH_KEY); } catch {} }
function isLoggedIn()    { return !!getToken(); }

// Cabeçalhos com o token (mesclando com o que for passado).
function authHeaders(extra) {
  const t = getToken();
  return Object.assign({}, extra || {}, t ? { Authorization: 'Bearer ' + t } : {});
}

function showLogin(msg) {
  const ov = document.getElementById('login-overlay');
  if (ov) ov.classList.add('open');
  const err = document.getElementById('login-error');
  if (err) { err.textContent = msg || ''; err.style.display = msg ? 'block' : 'none'; }
  const inp = document.getElementById('login-pass');
  if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 50); }
}

function hideLogin() {
  const ov = document.getElementById('login-overlay');
  if (ov) ov.classList.remove('open');
}

async function doLogin() {
  const inp  = document.getElementById('login-pass');
  const btn  = document.getElementById('login-btn');
  const pass = inp ? inp.value : '';
  if (!pass) { showLogin('Digite a senha.'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass }),
    });
    if (res.status === 401) { showLogin('Senha incorreta. Tente novamente.'); return; }
    if (!res.ok) { showLogin('Erro no servidor. Tente novamente em instantes.'); return; }
    const j = await res.json();
    setToken(j.token);
    hideLogin();
    if (typeof startApp === 'function') await startApp();
  } catch {
    showLogin('Sem conexão. Verifique a internet e tente de novo.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
  }
}

function logout() {
  clearToken();
  location.reload();
}

// Chamado quando o servidor recusa o token (expirado/inválido).
function onAuthExpired() {
  clearToken();
  showLogin('Sua sessão expirou. Entre novamente.');
}

// Enter no campo de senha faz login.
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('login-pass');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
});
