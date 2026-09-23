import { NextResponse, type NextRequest } from 'next/server';

import { STATS_SOURCE_COOKIE } from '@/lib/source-mode';

function setSourceCookie(response: NextResponse, source: string): NextResponse {
  response.cookies.set(STATS_SOURCE_COOKIE, source, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  return response;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/saas';
    return setSourceCookie(NextResponse.redirect(url), 'saas');
  }

  if (pathname === '/cursor' || pathname.startsWith('/cursor/')) {
    return setSourceCookie(NextResponse.next(), 'cursor');
  }

  if (pathname === '/mcp' || pathname.startsWith('/mcp/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/mcp' ? '/saas' : `/saas${pathname.slice('/mcp'.length)}`;
    return setSourceCookie(NextResponse.redirect(url), 'saas');
  }

  if (pathname === '/saas' || pathname.startsWith('/saas/')) {
    return setSourceCookie(NextResponse.next(), 'saas');
  }

  const opencodeRoots = [
    '/opencode',
    '/projects',
    '/time',
    '/tools',
    '/models',
    '/sessions',
  ];
  const isOpenCodeRoute = opencodeRoots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );

  if (isOpenCodeRoute) {
    return setSourceCookie(NextResponse.next(), 'opencode');
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/opencode',
    '/opencode/:path*',
    '/projects/:path*',
    '/time/:path*',
    '/tools/:path*',
    '/models/:path*',
    '/sessions/:path*',
    '/cursor',
    '/cursor/:path*',
    '/saas',
    '/saas/:path*',
    '/mcp',
    '/mcp/:path*',
  ],
};
