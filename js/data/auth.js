// Autenticação Google (V2.2) — opcional e desligada por padrão.
// Quando um Client ID OAuth é configurado em Ajustes, o app usa o Google Identity
// Services para obter um ID token da conta Google da usuária. O token vai em cada
// chamada ao backend, que o valida (assinatura via tokeninfo, audiência, e-mail na
// lista de permitidos). Sem Client ID, o app usa apenas a chave compartilhada.
import { LocalStore } from './localStore.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisLoading = null;
let listeners = new Set();

function decodeJwt(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch {
    return null;
  }
}

function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GIS_SRC;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { gisLoading = null; reject(new Error('Não foi possível carregar o login Google')); };
      document.head.appendChild(s);
    });
  }
  return gisLoading;
}

export const Auth = {
  /** Sessão atual, se válida (token ainda não expirou). */
  session() {
    const a = LocalStore.loadAuth();
    if (!a?.token) return null;
    if (a.exp * 1000 < Date.now() + 60_000) return { ...a, expired: true };
    return a;
  },
  async getIdToken() {
    const s = Auth.session();
    return s && !s.expired ? s.token : null;
  },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  signOut() {
    LocalStore.saveAuth(null);
    window.google?.accounts?.id?.disableAutoSelect?.();
    listeners.forEach((fn) => fn(null));
  },
  /** Renderiza o botão oficial "Entrar com Google" dentro de `container`. */
  async renderButton(container, clientId) {
    await loadGis();
    window.google.accounts.id.initialize({
      client_id: clientId,
      auto_select: true,
      callback: ({ credential }) => {
        const p = decodeJwt(credential);
        if (!p) return;
        const session = { token: credential, email: p.email, name: p.given_name || p.name, picture: p.picture, exp: p.exp };
        LocalStore.saveAuth(session);
        listeners.forEach((fn) => fn(session));
      },
    });
    window.google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'pt-BR' });
  },
};
