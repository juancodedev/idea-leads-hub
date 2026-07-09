/**
 * CORS configuration for the CRM API.
 *
 * Soportar Origin: null es necesario para clientes que cargan desde
 * el protocolo file:// (el browser envía "null" como origin).
 *
 * La spec de CORS dice que Access-Control-Allow-Origin: * NO cubre el
 * valor null, así que hay que devolver explícitamente "null" en el header.
 */

const ALLOWED_ORIGINS = new Set([
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'null', // file:// protocol → Origin: null
].filter(Boolean));

const CORS_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

const CORS_HEADERS_ALLOW = 'authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip';

/**
 * Resuelve el valor correcto para Access-Control-Allow-Origin
 * basado en el Origin de la request.
 *
 * - null (file://) → devuelve "null"
 * - ALLOWED_ORIGINS match → devuelve el origin
 * - development → devuelve el origin (todo permitido)
 * - default → null (seguro)
 */
export function resolveOrigin(requestOrigin: string | null): string {
  if (!requestOrigin) return 'null';

  if (process.env.NODE_ENV === 'development') return requestOrigin;

  if (ALLOWED_ORIGINS.has(requestOrigin)) return requestOrigin;

  // Fallback seguro — se rechaza en el browser pero no se expone *
  return 'null';
}

/**
 * Retorna headers CORS para una request específica.
 * NO incluye Content-Type — eso lo pone cada route.
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveOrigin(requestOrigin),
    'Access-Control-Allow-Methods': CORS_METHODS,
    'Access-Control-Allow-Headers': CORS_HEADERS_ALLOW,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

/**
 * Maneja OPTIONS preflight.
 * Devuelve 204 con headers CORS o null si no es OPTIONS.
 */
export function handlePreflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;

  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin);

  return new Response(null, {
    status: 204,
    headers,
  });
}

/**
 * Envuelve una Response con headers CORS.
 */
export function withCors(response: Response, requestOrigin: string | null): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', resolveOrigin(requestOrigin));
  headers.set('Vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
