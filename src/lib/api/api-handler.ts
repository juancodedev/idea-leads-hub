import { NextRequest, NextResponse } from 'next/server';
import { NotFoundError, ConflictError, UnauthorizedError, DatabaseError } from '@/infrastructure/repositories/errors';
import { ZodError } from 'zod';

type ApiHandler = (request: NextRequest, context?: any) => Promise<Response>;

export function apiHandler(handler: ApiHandler): ApiHandler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
      if (error instanceof NotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
      if (error instanceof ConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
      if (error instanceof ZodError) return NextResponse.json({ error: 'Error de validación', details: error.format() }, { status: 400 });
      if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
      if (error instanceof DatabaseError) return NextResponse.json({ error: error.message }, { status: 500 });
      // Fallback
      console.error('API Error:', error);
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
  };
}
