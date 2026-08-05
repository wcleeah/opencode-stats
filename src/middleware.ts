import { NextResponse, type NextRequest } from 'next/server';

import { STATS_SOURCE_COOKIE } from '@/lib/source-mode';

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  if (pathname === '/cursor' || pathname.startsWith('/cursor/')) {
    response.cookies.set(STATS_SOURCE_COOKIE, 'cursor', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    return response;
  }

  const opencodeRoots = ['/', '/projects', '/time', '/tools', '/models', '/sessions'];
  const isOpenCodeRoute = opencodeRoots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );

  if (isOpenCodeRoute) {
    response.cookies.set(STATS_SOURCE_COOKIE, 'opencode', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/',
    '/projects/:path*',
    '/time/:path*',
    '/tools/:path*',
    '/models/:path*',
    '/sessions/:path*',
    '/cursor/:path*',
  ],
};
