import * as cheerio from 'cheerio';
import http from 'node:http';
import https from 'node:https';
import { URL, URLSearchParams } from 'node:url';
import { incrementDniCounter } from './dni-counter';
import { dnipeuService } from './dniperu-service';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.72 Safari/537.36',
};

type HttpResponse = {
  url: string;
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
};

type ParsedDictionaryValue = string | string[];
type ParsedDictionary = Record<string, ParsedDictionaryValue>;

export interface DniLookupResult {
  dni: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  codVerifica: string;
}

export interface ParsedCompany {
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  tipo: string;
  estado: string;
  condicion: string;
  direccion: string;
  fechaInscripcion: string | null;
  departamento: string;
  provincia: string;
  distrito: string;
}

export interface LegacyCompanyResult {
  RUC: string;
  nombre: string;
  tipo_contribuyente: string;
  ncomercial: string;
  condicion: string;
  estado_contribuyente: string;
  fechai: string;
  departamento: string;
  provincia: string;
  distrito: string;
  domicilio_fiscal: string;
}

interface DniApiResponse {
  first_name?: string;
  first_last_name?: string;
  second_last_name?: string;
  full_name?: string;
  document_number?: string;
}

interface LookupProvider<T> {
  source: string;
  service: {
    get(value: string): Promise<T | null>;
  };
}

interface LookupServiceOptions {
  rucProviders?: LookupProvider<ParsedCompany>[];
  dniProviders?: LookupProvider<DniLookupResult>[];
}

class HttpClient {
  private cookies = new Map<string, string>();

  async getResponse(urlStr: string, headers: Record<string, string> = {}) {
    return this.request(urlStr, { method: 'GET', headers });
  }

  async postResponse(urlStr: string, data: Record<string, string>, headers: Record<string, string> = {}) {
    const body = new URLSearchParams(data).toString();

    return this.request(urlStr, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': String(Buffer.byteLength(body)),
        ...headers,
      },
    });
  }

  private async request(
    urlStr: string,
    init: { method: 'GET' | 'POST'; headers?: Record<string, string>; body?: string },
    redirectCount = 0
  ): Promise<HttpResponse> {
    // Timeout absoluto sobre toda la operación (conexión + transferencia completa).
    // Cubre el caso donde SUNAT acepta la conexión pero manda datos muy lentamente.
    const ABSOLUTE_TIMEOUT_MS = 10_000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Absolute timeout after ${ABSOLUTE_TIMEOUT_MS}ms: ${urlStr}`)), ABSOLUTE_TIMEOUT_MS)
    );

    return Promise.race([this._request(urlStr, init, redirectCount), timeoutPromise]);
  }

  private async _request(
    urlStr: string,
    init: { method: 'GET' | 'POST'; headers?: Record<string, string>; body?: string },
    redirectCount = 0
  ): Promise<HttpResponse> {
    return await new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlStr);
      const isHttps = parsedUrl.protocol === 'https:';
      const transport = isHttps ? https : http;
      const headers = {
        ...DEFAULT_HEADERS,
        ...init.headers,
      };

      const cookieHeader = this.buildCookieHeader();
      if (cookieHeader) {
        headers.Cookie = cookieHeader;
      }

      const req = transport.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: init.method,
          headers,
          timeout: 8000, // 8s — evita conexiones colgadas si SUNAT no responde
        },
        (res) => {
          this.saveCookies(res.headers['set-cookie']);

          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (redirectCount >= 5) {
              reject(new Error(`Too many redirects while requesting ${urlStr}`));
              return;
            }

            const redirectUrl = new URL(res.headers.location, urlStr).toString();
            resolve(this.request(redirectUrl, { method: 'GET', headers: init.headers }, redirectCount + 1));
            return;
          }

          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              url: urlStr,
              statusCode: res.statusCode || 0,
              headers: res.headers,
              body: data,
            });
          });
        }
      );

      req.on('error', reject);

      req.on('timeout', () => {
        req.destroy(new Error(`Request timeout after 8000ms: ${urlStr}`));
      });

      if (init.body) {
        req.write(init.body);
      }

      req.end();
    });
  }

  private saveCookies(rawCookies: string[] | undefined) {
    if (!rawCookies) {
      return;
    }

    for (const rawCookie of rawCookies) {
      const firstPart = rawCookie.split(';')[0];
      const separatorIndex = firstPart.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const key = firstPart.slice(0, separatorIndex).trim();
      const value = firstPart.slice(separatorIndex + 1).trim();
      if (key) {
        this.cookies.set(key, value);
      }
    }
  }

  private buildCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }
}

/**
 * Utilidad DNI: obtiene el dígito verificador
 */
export function getVerifyCode(dni: string): number | null {
  if (!dni || dni.length !== 8 || Number.isNaN(Number(dni))) {
    return null;
  }

  let suma = 5;
  const hash = [3, 2, 7, 6, 5, 4, 3, 2];

  for (let i = 0; i < dni.length; i += 1) {
    suma += Number(dni[i]) * hash[i];
  }

  const entero = Math.floor(suma / 11);
  const digito = 11 - (suma - entero * 11);

  return digito > 9 ? digito - 10 : digito;
}

/**
 * Parser para respuestas HTML de SUNAT
 */
function parseHtmlRecaptchaDictionary(html: string) {
  const $ = cheerio.load(html);
  const container = $("div.list-group").first();
  if (!container.length) return null;

  const dic: ParsedDictionary = {};

  container.children().each((_, row) => {
    const $row = $(row);
    const keys = $row.find(".list-group-item-heading");
    const values = $row.find(".list-group-item-text");

    if (values.length === 0 && keys.length === 2) {
      dic[$(keys[0]).text().trim()] = $(keys[1]).text().trim();
      return;
    }

    for (let i = 0; i < keys.length; i += 1) {
      const title = $(keys[i]).text().trim();
      if (!title) continue;

      if (values.length > i) {
        dic[title] = $(values[i]).text().trim();
      } else {
        const tableValues: string[] = [];
        $row.find("table tbody tr td").each((_, td) => {
          tableValues.push($(td).text().trim());
        });
        dic[title] = tableValues;
      }
    }
  });

  return dic;
}

function parseLegacyTableDictionary(html: string) {
  const $ = cheerio.load(html);
  const table = $("html > body > table").first();
  if (!table.length) return null;

  const dic: ParsedDictionary = {};
  table.children().each((_, tr) => {
    const tds = $(tr).children().filter((_, node) => (node as { tagName?: string }).tagName === "td");
    if (tds.length < 2) return;

    for (let i = 0; i + 1 < tds.length; i += 2) {
      const title = $(tds[i]).text().trim();
      const valueNode = $(tds[i + 1]);
      if (!title) continue;

      const options = valueNode.find("select option");
      if (options.length) {
        const arr: string[] = [];
        options.each((_, op) => arr.push($(op).text().trim()));
        dic[title] = arr;
      } else {
        dic[title] = valueNode.text().trim();
      }
    }
  });

  return Object.keys(dic).length ? dic : null;
}

function parseDate(text: string) {
  if (!text || text === "-") return null;
  const parts = text.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

function getFirstLine(text: string) {
  return String(text || "").split(/\r?\n/)[0].trim();
}

function getDepartment(dep: string) {
  const overridDeps: Record<string, string> = {
    DIOS: "MADRE DE DIOS",
    MARTIN: "SAN MARTIN",
    LIBERTAD: "LA LIBERTAD",
    CALLAO: "PROV. CONST. DEL CALLAO",
  };
  const value = String(dep || "").toUpperCase();
  return overridDeps[value] || value;
}

export function parseCompany(html: string): ParsedCompany | null {
  const dic = parseHtmlRecaptchaDictionary(html) || parseLegacyTableDictionary(html);
  if (!dic) return null;

  const rucRaw = dic["Número de RUC:"] || dic["RUC:"] || "";
  const pos = rucRaw.indexOf("-");
  const ruc = pos === -1 ? "" : rucRaw.slice(0, pos).trim();
  const razonSocial = pos === -1 ? "" : rucRaw.slice(pos + 1).trim();

  const company: ParsedCompany = {
    ruc,
    razonSocial,
    nombreComercial: dic["Nombre Comercial:"] || "",
    tipo: dic["Tipo Contribuyente:"] || "",
    estado: dic["Estado del Contribuyente:"] || dic["Estado:"] || "",
    condicion: getFirstLine(dic["Condición del Contribuyente:"] || dic["Condición:"] || ""),
    direccion: dic["Domicilio Fiscal:"] || dic["Dirección del Domicilio Fiscal:"] || "",
    fechaInscripcion: parseDate(dic["Fecha de Inscripción:"] || ""),
    departamento: "",
    provincia: "",
    distrito: "",
  };

  // Corregir Estado
  const lines = String(company.estado || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (lines.length > 0) company.estado = lines[0];

  // Corregir Dirección
  const rawDir = String(company.direccion || "");
  const items = rawDir.split("                                               -");
  if (items.length === 3) {
    const pieces = items[0].trim().split(" ").filter(Boolean);
    const department = getDepartment(pieces[pieces.length - 1]);
    company.departamento = department;
    company.provincia = items[1].trim();
    company.distrito = items[2].trim();
    pieces.splice(-department.split(" ").length);
    company.direccion = pieces.join(" ").trim();
  } else {
    company.direccion = rawDir.replace(/[\s]+/g, " ").trim();
  }

  return company;
}

function parseSunatFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 3) {
    const apellidoPaterno = parts[0];
    const apellidoMaterno = parts[1];
    const nombres = parts.slice(2).join(' ');
    return { nombres, apellidoPaterno, apellidoMaterno };
  } else if (parts.length === 2) {
    const apellidoPaterno = parts[0];
    const nombres = parts[1];
    return { nombres, apellidoPaterno, apellidoMaterno: '' };
  } else {
    return { nombres: fullName, apellidoPaterno: '', apellidoMaterno: '' };
  }
}

/**
 * Clientes de API
 */
export class DniService {
  async get(dni: string): Promise<DniLookupResult | null> {
    // 1. Primero intentar con SUNAT scraper (RUC 10 + DNI + dígito verificador)
    try {
      const verifyDigit = getVerifyCode(dni);
      if (verifyDigit !== null) {
        const ruc = `10${dni}${verifyDigit}`;
        console.log(`[DniService] Querying SUNAT for RUC: ${ruc}`);
        const rucService = new RucService();
        const company = await rucService.get(ruc);
        if (company && company.razonSocial) {
          const parsed = parseSunatFullName(company.razonSocial);
          return {
            dni,
            apellidoPaterno: parsed.apellidoPaterno,
            apellidoMaterno: parsed.apellidoMaterno,
            nombres: parsed.nombres,
            codVerifica: String(verifyDigit),
          };
        }
      }
    } catch (e: any) {
      console.log(`[DniService SUNAT Error] ${e?.message || e} — falling back to dnipeu`);
    }

    // 2. Fallback: dnipeu.com (scraper)
    try {
      console.log(`[DniService] Querying dnipeu.com for DNI ${dni}`);
      const result = await dnipeuService.get(dni);
      if (result) return result;
    } catch (e: any) {
      console.log(`[DniService dnipeu Error] ${e?.message || e} — falling back to Decolecta`);
    }

    // 3. Fallback: Decolecta API
    const token = process.env.DECOLECTA_TOKEN || process.env.APIS_NET_PE_TOKEN || process.env.APIS_TOKEN;
    if (token) {
      const url = `https://api.decolecta.com/v1/reniec/dni?numero=${dni}`;
      try {
        console.log(`[DniService] Querying Decolecta API for DNI ${dni}`);
        const result = await $fetch<DniApiResponse>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (result && result.first_name) {
          const mappedResult = {
            dni: result.document_number || dni,
            apellidoPaterno: result.first_last_name || "",
            apellidoMaterno: result.second_last_name || "",
            nombres: result.first_name || "",
            codVerifica: String(getVerifyCode(dni)),
          };
          const fullName = `${mappedResult.nombres} ${mappedResult.apellidoPaterno} ${mappedResult.apellidoMaterno}`.trim();
          await incrementDniCounter(dni, true, fullName);
          return mappedResult;
        } else {
          console.warn("[DniService Decolecta] Response did not contain first_name:", result);
          await incrementDniCounter(dni, false, "Invalid response schema");
        }
      } catch (e: any) {
        console.error("[DniService Decolecta Error]", e?.message || e);
        await incrementDniCounter(dni, false, e?.message || "Request error");
      }
    }

    return null;
  }
}

/**
 * Scraper de dnipeu.com (https://dniperu.com/buscar-dni-nombres-apellidos/) ubicado en
 * ./dniperu-service.ts. El singleton exportado `dnipeuService` se importa al
 * inicio de este módulo y se usa como fallback entre SUNAT y Decolecta.
 */

export class RucService {
  async get(ruc: string): Promise<ParsedCompany> {
    const endpoint = "https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/jcrS00Alias";
    const client = new HttpClient();
    try {
      const initialResponse = await client.getResponse(endpoint);
      this.assertSuccessfulResponse(initialResponse, 'SUNAT_RUC_GET_FAILED');

      const randomResponse = await client.postResponse(endpoint, {
        accion: 'consPorRazonSoc',
        razSoc: 'BVA FOODS',
      });
      this.assertSuccessfulResponse(randomResponse, 'SUNAT_RUC_RANDOM_FAILED');
      const htmlRandom = randomResponse.body;
      this.assertNotBlocked(htmlRandom);

      const randomMatch = htmlRandom.match(/<input type="hidden" name="numRnd" value="(.*)">/);
      const random = randomMatch ? randomMatch[1] : "";

      const resultResponse = await client.postResponse(endpoint, {
        accion: 'consPorRuc',
        nroRuc: ruc,
        numRnd: random,
        actReturn: '1',
        modo: '1',
      });
      this.assertSuccessfulResponse(resultResponse, 'SUNAT_RUC_LOOKUP_FAILED');
      const html = resultResponse.body;
      this.assertNotBlocked(html);

      const company = parseCompany(html);
      if (!company) {
        const error = new Error('RUC no encontrado');
        (error as Error & { statusCode?: number; code?: string }).statusCode = 404;
        (error as Error & { statusCode?: number; code?: string }).code = 'RUC_NOT_FOUND';
        throw error;
      }
      return company;
    } catch (e) {
      console.error("[RucService Error]", e);
      throw e;
    }
  }

  private assertNotBlocked(html: string) {
    if (!html || !html.includes('Request Rejected')) {
      return;
    }

    const supportIdMatch = html.match(/support ID is:\s*<([^>]+)>/i);
    const supportId = supportIdMatch ? supportIdMatch[1] : 'N/A';
    const error = new Error(`SUNAT_WAF_BLOCKED support_id=${supportId}`);
    (error as Error & { code?: string; statusCode?: number }).code = 'SUNAT_WAF_BLOCKED';
    (error as Error & { code?: string; statusCode?: number }).statusCode = 502;
    throw error;
  }

  private assertSuccessfulResponse(response: HttpResponse, code: string) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
    }

    const error = new Error(`${code} status=${response.statusCode}`);
    (error as Error & { code?: string; statusCode?: number }).code = code;
    (error as Error & { code?: string; statusCode?: number }).statusCode = response.statusCode;
    throw error;
  }
}

/**
 * Servicio principal de consulta
 */
export class LookupService {
  rucProviders: LookupProvider<ParsedCompany>[];
  dniProviders: LookupProvider<DniLookupResult>[];

  constructor(options: LookupServiceOptions = {}) {
    this.rucProviders = options.rucProviders || [{ source: 'http', service: new RucService() }];
    this.dniProviders = options.dniProviders || [{ source: 'http', service: new DniService() }];
  }

  async getDni(dni: string): Promise<DniLookupResult> {
    for (const provider of this.dniProviders) {
      const data = await provider.service.get(dni);
      if (data) return data;
    }
    throw new Error("DNI no encontrado");
  }

  async getRuc(ruc: string): Promise<ParsedCompany> {
    for (const provider of this.rucProviders) {
      const data = await provider.service.get(ruc);
      if (data) return data;
    }
    const error = new Error("RUC no encontrado");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  async getRucLegacy(ruc: string): Promise<LegacyCompanyResult> {
    const company = await this.getRuc(ruc);
    return mapCompanyToLegacyRtn(company);
  }
}

/**
 * Mapeadores
 */
export function mapCompanyToLegacyRtn(company: ParsedCompany | null): LegacyCompanyResult {
  if (!company) return { RUC: "00000000000" };
  const fecha = (company.fechaInscripcion || "").replace("T00:00:00.000Z", "");
  return {
    RUC: company.ruc || "00000000000",
    nombre: company.razonSocial || "",
    tipo_contribuyente: company.tipo || "",
    ncomercial: company.nombreComercial || "",
    condicion: company.condicion || "",
    estado_contribuyente: company.estado || "",
    fechai: fecha,
    departamento: company.departamento || "",
    provincia: company.provincia || "",
    distrito: company.distrito || "",
    domicilio_fiscal: company.direccion || "",
  };
}
