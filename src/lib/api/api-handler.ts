import { NextRequest, NextResponse } from 'next/server';
import { NotFoundError, ConflictError, UnauthorizedError, DatabaseError } from '@/infrastructure/repositories/errors';
import { ZodError } from 'zod';
import { checkRateLimit } from './rate-limit';
import { logger } from '@/lib/logger';

type ApiHandler = (request: NextRequest, context?: any) => Promise<Response>;

export function apiHandler(handler: ApiHandler, options?: { rateLimit?: { max: number; windowSeconds: number } }): ApiHandler {
  return async (request, context) => {
    try {
      // Rate limiting
      if (options?.rateLimit) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? request.headers.get('x-real-ip')
          ?? 'unknown';

        const { allowed, remaining, resetAt } = checkRateLimit(ip, options.rateLimit);

        if (!allowed) {
          return NextResponse.json(
            { error: 'Demasiadas solicitudes. Intentalo de nuevo más tarde.' },
            {
              status: 429,
              headers: {
                'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
                'X-RateLimit-Remaining': '0',
              },
            }
          );
        }
      }

      return await handler(request, context);
    } catch (error) {
      if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
      if (error instanceof NotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
      if (error instanceof ConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
      if (error instanceof ZodError) return NextResponse.json({ error: 'Error de validación', details: error.format() }, { status: 400 });
      if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
      if (error instanceof DatabaseError) return NextResponse.json({ error: error.message }, { status: 500 });
      // Fallback
      logger.error('API Error', { url: request.url, method: request.method, error: String(error) });
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
  };
}
