import { incrementDniCounter } from './dni-counter';
import type { DniLookupResult } from './ruc-search';

/**
 * Scraper de dnipeu.com (https://dniperu.com/buscar-dni-nombres-apellidos/).
 *
 * Usa el endpoint AJAX de WordPress directamente con un flujo de dos pasos:
 *   1) GET  /buscar-dni-nombres-apellidos/  → inicia las cookies de sesión
 *   2) POST admin-ajax.php action=cc_get_tokens → cc_token + cc_sig (TTL ~120s)
 *   3) POST admin-ajax.php action=buscar_nombres&dni4=... → {success, data:{message}}
 *
 * Las cookies de sesión y el token se cachean en memoria por proceso y se reusan
 * entre consultas. El token se refresca cuando faltan menos de 15s para expirar.
 */

const DNIPERU_AJAX_URL = 'https://dniperu.com/wp-admin/admin-ajax.php';
const DNIPERU_PAGE_URL = 'https://dniperu.com/buscar-dni-nombres-apellidos/';
const DNIPERU_ORIGIN = 'https://dniperu.com';
const DNIPERU_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DNIPERU_TIMEOUT_MS = 20_000;
const DNIPERU_TOKEN_CONTEXT = 'buscar_nombres';

interface DniperuToken {
  cc_token: string;
  cc_sig: string;
  expiresAt: number; // época en ms
}

export class DniperuService {
  private cookies = new Map<string, string>();
  private token: DniperuToken | null = null;
  private sessionPrimed = false;

  private setCookiesFromResponse(res: { headers: Headers }) {
    // undici / Nitro fetch expone getSetCookie()
    const raw =
      typeof (res.headers as any).getSetCookie === 'function'
        ? (res.headers as any).getSetCookie()
        : [];
    for (const c of raw as string[]) {
      const [pair] = c.split(';');
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (name) this.cookies.set(name, value);
    }
  }

  private cookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private commonHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': DNIPERU_UA,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: DNIPERU_PAGE_URL,
      Origin: DNIPERU_ORIGIN,
      Accept: 'application/json, text/javascript, */*; q=0.01',
    };
    const cookies = this.cookieHeader();
    if (cookies) headers.Cookie = cookies;
    return headers;
  }

  private async primeSession() {
    if (this.sessionPrimed) return;
    const res = await $fetch.raw(DNIPERU_PAGE_URL, {
      method: 'GET',
      headers: {
        'User-Agent': DNIPERU_UA,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-PE,es;q=0.9',
      },
      timeout: DNIPERU_TIMEOUT_MS,
      ignoreResponseError: true,
    });
    this.setCookiesFromResponse(res as any);
    this.sessionPrimed = true;
  }

  private tokenIsValid(): boolean {
    if (!this.token) return false;
    // Refresca hasta 15s antes de la expiración real para evitar condiciones de carrera.
    return this.token.expiresAt - Date.now() > 15_000;
  }

  private async fetchToken(): Promise<DniperuToken> {
    const fd = new FormData();
    fd.append('action', 'cc_get_tokens');
    fd.append('context', DNIPERU_TOKEN_CONTEXT);
    fd.append('company', '');
    fd.append('count', '1');

    const res = await $fetch.raw(DNIPERU_AJAX_URL, {
      method: 'POST',
      headers: this.commonHeaders(),
      body: fd,
      timeout: DNIPERU_TIMEOUT_MS,
      ignoreResponseError: true,
    });
    this.setCookiesFromResponse(res as any);

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`cc_get_tokens HTTP ${res.status}`);
    }

    const json = (res._data ?? {}) as {
      success?: boolean;
      data?: {
        tokens?: DniperuToken[];
        cc_token?: string;
        cc_sig?: string;
        expires_at?: number;
        ttl?: number;
      };
    };

    if (!json?.success || !json?.data) {
      throw new Error(`cc_get_tokens failed: ${JSON.stringify(json).slice(0, 200)}`);
    }

    const t = Array.isArray(json.data.tokens) ? json.data.tokens[0] : json.data;
    if (!t?.cc_token || !t?.cc_sig) {
      throw new Error('cc_get_tokens missing cc_token/cc_sig');
    }

    // expires_at es un valor en segundos unix; convertir a ms.
    const expiresAtSec =
      typeof t.expires_at === 'number'
        ? t.expires_at
        : Math.floor(Date.now() / 1000) + (json.data.ttl ?? 120);
    const expiresAt = expiresAtSec * 1000;

    this.token = { cc_token: t.cc_token, cc_sig: t.cc_sig, expiresAt };
    return this.token;
  }

  private async ensureToken(): Promise<DniperuToken> {
    await this.primeSession();
    if (this.tokenIsValid()) return this.token!;
    return this.fetchToken();
  }

  private parseMessage(dni: string, message: string): DniLookupResult | null {
    if (!message) return null;

    const lines = message
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const get = (label: string): string => {
      const re = new RegExp(`${label}\\s*:?\\s*(.+)$`, 'i');
      for (const line of lines) {
        const m = line.match(re);
        if (m) return m[1].trim();
      }
      return '';
    };

    const dniVal = get('Numero de DNI') || get('DNI') || dni;
    const nombres = get('Nombres');
    const apellidoPaterno = get('Apellido Paterno');
    const apellidoMaterno = get('Apellido Materno');

    if (!nombres && !apellidoPaterno && !apellidoMaterno) return null;

    return {
      dni: dniVal,
      apellidoPaterno,
      apellidoMaterno,
      nombres,
      codVerifica: get('Codigo de Verificacion') || get('Código de Verificación') || '',
    };
  }

  async get(dni: string): Promise<DniLookupResult | null> {
    if (!/^\d{8}$/.test(dni)) return null;

    try {
      const token = await this.ensureToken();

      const fd = new FormData();
      fd.append('action', 'buscar_nombres');
      fd.append('dni4', dni);
      fd.append('buscar_dni', '1');
      fd.append('company', '');
      fd.append('cc_token', token.cc_token);
      fd.append('cc_sig', token.cc_sig);

      const res = await $fetch.raw(DNIPERU_AJAX_URL, {
        method: 'POST',
        headers: this.commonHeaders(),
        body: fd,
        timeout: DNIPERU_TIMEOUT_MS,
        ignoreResponseError: true,
      });
      this.setCookiesFromResponse(res as any);

      if (res.status === 403) {
        // La sesión puede haber sido invalidada; limpiar caché y reiniciar en la próxima llamada.
        this.cookies.clear();
        this.sessionPrimed = false;
        this.token = null;
        throw new Error(`buscar_nombres HTTP 403`);
      }

      if (res.status < 200 || res.status >= 300) {
        throw new Error(`buscar_nombres HTTP ${res.status}`);
      }

      const json = (res._data ?? {}) as {
        success?: boolean;
        message?: string;
        data?: { message?: string; code?: string };
      };

      if (!json?.success) {
        const msg = json?.message || json?.data?.message || 'unknown error';
        console.log(`[DniperuService] upstream error: ${msg}`);
        return null;
      }

      const message = json?.data?.message;
      const parsed = this.parseMessage(dni, message || '');
      if (!parsed) {
        console.warn('[DniperuService] could not parse message:', message);
        return null;
      }

      await incrementDniCounter(dni, true, `${parsed.nombres} ${parsed.apellidoPaterno} ${parsed.apellidoMaterno}`.trim());
      return parsed;
    } catch (e: any) {
      console.error('[DniperuService Error]', e?.message || e);
      await incrementDniCounter(dni, false, e?.message || 'Request error');
      return null;
    }
  }
}

// Singleton a nivel de módulo para compartir cookies y token entre solicitudes del mismo proceso.
export const dnipeuService = new DniperuService();
