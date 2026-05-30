import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { createToken } from '@/lib/auth';
import { initDB } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const { email, password, username } = await req.json();

    if (!email || !password || !username) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await sql`
      INSERT INTO users (email, password_hash, username)
      VALUES (${email}, ${passwordHash}, ${username})
      RETURNING id, email, username
    `;

    const token = await createToken({ userId: String(user.id), email: user.email, username: user.username });

    const response = NextResponse.json({ user: { id: user.id, email: user.email, username: user.username } });
    response.cookies.set('apex-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
