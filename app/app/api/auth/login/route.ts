export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql, { initDB } from '@/lib/db';
import { createToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const allowed = await checkRateLimit(`login:${ip}`, 5, 15 * 60);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const [user] = await sql`SELECT id, email, username, password_hash FROM users WHERE email = ${email}`;
    const hashToCompare = user?.password_hash ?? '$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';
    let valid = false;
    try { valid = await bcrypt.compare(password, hashToCompare); } catch { valid = false; }
    if (!user || !valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await createToken({ userId: String(user.id), email: user.email, username: user.username });

    const response = NextResponse.json({ user: { id: user.id, email: user.email, username: user.username } });
    response.cookies.set('apex-token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
