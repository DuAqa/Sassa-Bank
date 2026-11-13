// Cliente HTTP do backend (Google Apps Script Web App).
// Contrato: POST com corpo JSON enviado como text/plain (evita preflight CORS que o
// Apps Script não suporta). Toda chamada leva { action, key?, idToken?, ... }.
// Para trocar de backend (Firebase, Supabase, API própria), basta outro módulo
// que exponha as mesmas funções: ping(), pull(), push(ops).
import { APP } from '../config.js';

export class RemoteError extends Error {
  constructor(message, { code = 'NETWORK', status = 0 } = {}) {
    super(message);
    this.code = code; // NETWORK | TIMEOUT | AUTH | VALIDATION | SERVER
    this.status = status;
  }
}

export function createRemoteApi({ url, apiKey, getIdToken }) {
  async function call(action, payload = {}) {
    if (!url) throw new RemoteError('Backend não configurado', { code: 'CONFIG' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), APP.requestTimeoutMs);
    const body = { action, key: apiKey || undefined, idToken: (await getIdToken?.()) || undefined, ...payload };
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch (err) {
      throw new RemoteError(err.name === 'AbortError' ? 'Tempo esgotado' : 'Sem conexão com o servidor', {
        code: err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK',
      });
    } finally {
      clearTimeout(timer);
    }
    let json;
    try {
      json = await res.json();
    } catch {
      throw new RemoteError('Resposta inválida do servidor. Confira a URL do Apps Script.', { code: 'SERVER', status: res.status });
    }
    if (!json.ok) {
      throw new RemoteError(json.error || 'Erro no servidor', { code: json.code || 'SERVER', status: res.status });
    }
    return json;
  }

  return {
    ping: () => call('ping'),
    pull: () => call('pull'),
    push: (ops) => call('push', { ops }),
  };
}
