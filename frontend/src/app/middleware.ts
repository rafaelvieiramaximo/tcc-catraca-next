// middleware.ts (na raiz do projeto)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Verificar se o usuário está autenticado
  const currentUser = request.cookies.get('currentUser')?.value;

  if (!currentUser) {
    // Se não está autenticado e não está na página de login, redireciona
    if (!request.nextUrl.pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Parse do usuário
  const user = JSON.parse(currentUser);
  const isAdmin = user.tipo === 'ADMIN';
  const isPortaria = user.tipo === 'PORTARIA';

  // Proteção de rotas por tipo de usuário
  if (request.nextUrl.pathname.startsWith('/admin') && !isAdmin) {
    return NextResponse.redirect(new URL('/portaria', request.url));
  }

  if (request.nextUrl.pathname.startsWith('/portaria') && !isPortaria) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/portaria/:path*',
    '/entry-logs/:path*',
  ],
};