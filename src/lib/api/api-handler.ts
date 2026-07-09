import { NextRequest, NextResponse } from 'next/server';
import { NotFoundError, ConflictError, UnauthorizedError, DatabaseError } from '@/infrastructure/repositories/errors';
import { ZodError } from 'zod';
import { checkRateLimit } from './rate-limit';
import { handlePreflight, withCors } from './cors';
import { logger } from '@/lib/logger';

type ApiHandler = (request: NextRequest, context?: any) => Promise<Response>;

export function apiHandler(handler: ApiHandler, options?: { rateLimit?: { max: number; windowSeconds: number } }): ApiHandler {
  return async (request, context) => {
    const origin = request.headers.get('origin');

    // CORS preflight — OPTIONS antes del método real
    const preflight = handlePreflight(request);
    if (preflight) return preflight;

    try {
      // Rate limiting
      if (options?.rateLimit) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? request.headers.get('x-real-ip')
          ?? 'unknown';

        const { allowed, remaining, resetAt } = checkRateLimit(ip, options.rateLimit);

        if (!allowed) {
          return withCors(
            NextResponse.json(
              { error: 'Demasiadas solicitudes. Intentalo de nuevo más tarde.' },
              {
                status: 429,
                headers: {
                  'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
                  'X-RateLimit-Remaining': '0',
                },
              }
            ),
            origin
          );
        }
      }

      const response = await handler(request, context);
      return withCors(response, origin);
    } catch (error) {
      let response: NextResponse;

      if (error instanceof UnauthorizedError) response = NextResponse.json({ error: error.message }, { status: 401 });
      else if (error instanceof NotFoundError) response = NextResponse.json({ error: error.message }, { status: 404 });
      else if (error instanceof ConflictError) response = NextResponse.json({ error: error.message }, { status: 409 });
      else if (error instanceof ZodError) response = NextResponse.json({ error: 'Error de validación', details: error.format() }, { status: 400 });
      else if (error instanceof SyntaxError) response = NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
      else if (error instanceof DatabaseError) response = NextResponse.json({ error: error.message }, { status: 500 });
      else {
        // Fallback
        logger.error('API Error', { url: request.url, method: request.method, error: String(error) });
        response = NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
      }

      return withCors(response, origin);
    }
  };
}
