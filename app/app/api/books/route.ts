export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';

export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const books = await sql`
    SELECT * FROM books WHERE user_id = ${user.userId} ORDER BY created_at DESC
  `;
  return NextResponse.json({ books });
}

const VALID_STATUS = new Set(['read', 'wishlist']);

export async function POST(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ol_key, title, author, cover_id, isbn, star_rating, status } = await req.json();
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Title required' }, { status: 400 });
  }
  const rating = Math.max(0, Math.min(5, Number(star_rating) || 0));
  const bookStatus = VALID_STATUS.has(status) ? status : 'read';

  const [book] = await sql`
    INSERT INTO books (user_id, ol_key, title, author, cover_id, isbn, star_rating, status)
    VALUES (
      ${user.userId},
      ${ol_key || ''},
      ${title.trim().slice(0, 300)},
      ${(author || '').slice(0, 200)},
      ${(cover_id || '').slice(0, 50)},
      ${(isbn || '').slice(0, 20)},
      ${rating},
      ${bookStatus}
    )
    RETURNING *
  `;
  return NextResponse.json({ book });
}

export async function PATCH(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, star_rating, status } = await req.json();

  if (status !== undefined) {
    const bookStatus = VALID_STATUS.has(status) ? status : 'read';
    const rating = star_rating !== undefined ? Math.max(0, Math.min(5, Number(star_rating) || 0)) : null;
    if (rating !== null) {
      await sql`UPDATE books SET status = ${bookStatus}, star_rating = ${rating} WHERE id = ${id} AND user_id = ${user.userId}`;
    } else {
      await sql`UPDATE books SET status = ${bookStatus} WHERE id = ${id} AND user_id = ${user.userId}`;
    }
  } else {
    const rating = Math.max(0, Math.min(5, Number(star_rating) || 0));
    await sql`UPDATE books SET star_rating = ${rating} WHERE id = ${id} AND user_id = ${user.userId}`;
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await sql`DELETE FROM books WHERE id = ${id} AND user_id = ${user.userId}`;
  return NextResponse.json({ success: true });
}
