/**
 * CORS configuration for the CRM API.
 *
 * Only explicitly allowed origins receive Access-Control-Allow-Origin and
 * credentials. The opaque "null" origin (file://, sandboxed iframes, data:
 * URLs) is never allowed: any page can forge it, so allowing it together
 * with credentials would let arbitrary sites make authenticated requests.
 */

const ALLOWED_ORIGINS = new Set(
  [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173',
  ].filter(Boolean)
);

const CORS_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

const CORS_HEADERS_ALLOW = 'authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip';

/**
 * Resolves the Access-Control-Allow-Origin value for a request origin.
 *
 * - allowed origin → echoed back
 * - development → echoed back (except the opaque "null" origin)
 * - anything else (including missing or "null") → null, meaning the
 *   header must not be sent
 */
export function resolveOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin || requestOrigin === 'null') return null;

  if (process.env.NODE_ENV === 'development') return requestOrigin;

  if (ALLOWED_ORIGINS.has(requestOrigin)) return requestOrigin;

  return null;
}

/**
 * Returns CORS headers for a specific request.
 * Does NOT include Content-Type — each route sets that.
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': CORS_METHODS,
    'Access-Control-Allow-Headers': CORS_HEADERS_ALLOW,
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  const allowedOrigin = resolveOrigin(requestOrigin);
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Handles an OPTIONS preflight.
 * Returns 204 with CORS headers, or null when the request is not OPTIONS.
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
 * Wraps a Response with CORS headers.
 */
export function withCors(response: Response, requestOrigin: string | null): Response {
  const headers = new Headers(response.headers);
  const allowedOrigin = resolveOrigin(requestOrigin);
  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
  } else {
    headers.delete('Access-Control-Allow-Origin');
    headers.delete('Access-Control-Allow-Credentials');
  }
  headers.set('Vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
