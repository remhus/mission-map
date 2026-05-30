import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';

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
  const [entry] = await sql`
    INSERT INTO journal_entries (user_id, title, content, mood)
    VALUES (${user.userId}, ${title}, ${content || ''}, ${mood || 'neutral'})
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
    SET title = ${body.title}, content = ${body.content}, mood = ${body.mood}, updated_at = NOW()
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
