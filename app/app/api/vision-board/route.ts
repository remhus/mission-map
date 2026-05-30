import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';

export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const images = await sql`
    SELECT * FROM vision_board_images WHERE user_id = ${user.userId} ORDER BY sort_order, created_at
  `;
  return NextResponse.json({ images });
}

export async function POST(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { image_url, title, sort_order } = await req.json();
  const [image] = await sql`
    INSERT INTO vision_board_images (user_id, image_url, title, sort_order)
    VALUES (${user.userId}, ${image_url}, ${title || ''}, ${sort_order || 0})
    RETURNING *
  `;
  return NextResponse.json({ image });
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, title } = await req.json();
  await sql`UPDATE vision_board_images SET title = ${title} WHERE id = ${id} AND user_id = ${user.userId}`;
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await sql`DELETE FROM vision_board_images WHERE id = ${id} AND user_id = ${user.userId}`;
  return NextResponse.json({ success: true });
}

