export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const vbId = req.nextUrl.searchParams.get('vision_board_image_id');
  if (vbId) {
    const rows = await sql`
      SELECT * FROM achievements WHERE user_id = ${user.userId} AND vision_board_image_id = ${parseInt(vbId)}
    `;
    return NextResponse.json({ achievement: rows[0] || null });
  }

  const achievements = await sql`
    SELECT * FROM achievements WHERE user_id = ${user.userId} ORDER BY created_at DESC
  `;
  return NextResponse.json({ achievements });
}

export async function POST(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, description, trophy_tier, is_locked, vision_board_image_id } = await req.json();
  const [achievement] = await sql`
    INSERT INTO achievements (user_id, title, description, trophy_tier, is_locked, vision_board_image_id)
    VALUES (${user.userId}, ${title}, ${description || ''}, ${trophy_tier || 'bronze'}, ${is_locked !== false}, ${vision_board_image_id || null})
    RETURNING *
  `;
  return NextResponse.json({ achievement });
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, title, description, trophy_tier, is_locked } = await req.json();
  await sql`
    UPDATE achievements
    SET title = ${title}, description = ${description}, trophy_tier = ${trophy_tier}, is_locked = ${is_locked}
    WHERE id = ${id} AND user_id = ${user.userId}
  `;
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await sql`DELETE FROM achievements WHERE id = ${id} AND user_id = ${user.userId}`;
  return NextResponse.json({ success: true });
}
