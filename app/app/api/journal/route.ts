export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';
import { sanitizeRichHtml } from '@/lib/sanitize';

export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entries = await sql`
    SELECT * FROM journal_entries WHERE user_id = ${user.userId} ORDER BY created_at DESC
  `;
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, content, mood } = await req.json();
  const VALID_MOODS = new Set(['elite','focused','resilient','neutral','drained']);
  if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 300) {
    return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
  }
  if (typeof content === 'string' && content.length > 500000) {
    return NextResponse.json({ error: 'Content too long' }, { status: 400 });
  }
  const safeMood = VALID_MOODS.has(mood) ? mood : 'neutral';
  const safeContent = sanitizeRichHtml(content || '');
  const [entry] = await sql`
    INSERT INTO journal_entries (user_id, title, content, mood)
    VALUES (${user.userId}, ${title.trim()}, ${safeContent}, ${safeMood})
    RETURNING *
  `;
  return NextResponse.json({ entry });
}

export async function PUT(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id } = body;

  // Favourite toggle — lightweight update
  if (body.is_favourite !== undefined && !body.title) {
    await sql`UPDATE journal_entries SET is_favourite = ${body.is_favourite} WHERE id = ${id} AND user_id = ${user.userId}`;
    return NextResponse.json({ success: true });
  }

  await sql`
    UPDATE journal_entries
    SET title = ${body.title}, content = ${sanitizeRichHtml(body.content || '')}, mood = ${body.mood}, updated_at = NOW()
    WHERE id = ${id} AND user_id = ${user.userId}
  `;
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await sql`DELETE FROM journal_entries WHERE id = ${id} AND user_id = ${user.userId}`;
  return NextResponse.json({ success: true });
}
