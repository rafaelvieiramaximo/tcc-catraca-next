// middleware.ts (na raiz do projeto)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Verificar se o usuário está autenticado
  const currentUser = request.cookies.get('fatec-portaria-user')?.value;

  // Se não está autenticado e tenta acessar rotas protegidas
  if (!currentUser && 
      (request.nextUrl.pathname.startsWith('/admin') || 
       request.nextUrl.pathname.startsWith('/portaria') ||
       request.nextUrl.pathname.startsWith('/entry-logs'))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Se está autenticado, verificar tipo de usuário
  if (currentUser) {
    try {
      const user = JSON.parse(currentUser);
      const isAdmin = user.tipo === 'ADMIN';
      const isPortaria = user.tipo === 'PORTARIA';
      const isRH = user.tipo === 'RH';

      // RH tentando acessar rotas do ADMIN ou PORTARIA
      if (isRH && (request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/portaria'))) {
        return NextResponse.redirect(new URL('/usermanage', request.url));
      }

      // ADMIN tentando acessar rotas da PORTARIA
      if (isAdmin && request.nextUrl.pathname.startsWith('/portaria')) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }

      // PORTARIA tentando acessar rotas do ADMIN
      if (isPortaria && request.nextUrl.pathname.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/portaria', request.url));
      }

    } catch (error) {
      // Se houver erro ao parsear o usuário, redireciona para login
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete('fatec-portaria-user');
      response.cookies.delete('fatec-portaria-auth');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/portaria/:path*',
    '/entry-logs/:path*',
    '/usermanage/:path*',
  ],
};