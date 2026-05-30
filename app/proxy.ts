import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const PUBLIC = ['/login', '/signup'];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC.some(p => path.startsWith(p));
  const token = req.cookies.get('apex-token')?.value;

  if (isPublic) {
    if (token) {
      const user = await verifyToken(token);
      if (user) return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  if (!token) return NextResponse.redirect(new URL('/login', req.url));
  const user = await verifyToken(token);
  if (!user) {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete('apex-token');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|uploads).*)'],
};
