import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Rate Limiting for API routes ---
  if (pathname.startsWith('/api')) {
    // Stricter rate limit for auth endpoints
    if (pathname.startsWith('/api/auth')) {
      const limited = rateLimit(request, RATE_LIMITS.AUTH);
      if (limited) return limited;
    }
    // General rate limit for all other API routes
    else {
      const limited = rateLimit(request, RATE_LIMITS.API);
      if (limited) return limited;
    }
  }

  // --- Security: Block suspicious patterns ---
  // Block requests with common attack patterns in URL
  const suspiciousPatterns = [
    /\.env$/i, /\.git/i, /wp-admin/i, /wp-login/i,
    /phpmyadmin/i, /\.asp/i, /\.php$/i, /shell/i,
    /eval\(/i, /exec\(/i, /\/\.\.\//,
  ];
  if (suspiciousPatterns.some(p => p.test(pathname))) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // --- Authentication ---
  const session = await getSession();

  // Public routes - no auth needed
  const publicRoutes = ['/', '/about', '/contact', '/disclaimer', '/rules', '/wiki', '/status', '/signup', '/logout', '/store'];
  const isPublicRoute = publicRoutes.some(r => pathname === r || pathname.startsWith('/api/auth'));

  // Admin Routes - owner and admin only
  if (pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (!session.roles.some(r => ['owner', 'admin'].includes(r))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // God View - owner, admin, god roles only
  if (pathname.startsWith('/god')) {
    if (!session) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (!session.roles.some(r => ['owner', 'admin', 'god'].includes(r))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Protected routes - require authentication
  const protectedRoutes = ['/dashboard', '/profile', '/social', '/trades', '/tickets', '/inventory', '/players', '/visual-editor'];
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!session) {
      // For RSC prefetch requests, return 401 instead of redirect
      if (request.headers.get('rsc') === '1' || request.nextUrl.searchParams.has('_rsc')) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
      return NextResponse.redirect(new URL('/api/auth/login', request.url));
    }
  }

  // MC Username Enforcement: If logged in but no mc_username, force to /signup
  if (session && !session.mc_username) {
    if (
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/_next') &&
      pathname !== '/signup' &&
      pathname !== '/logout'
    ) {
      return NextResponse.redirect(new URL('/signup', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
