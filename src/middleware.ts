import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // TEMP: Skip auth check to test if dashboard loads
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|__nextjs_original-stack-frame|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};