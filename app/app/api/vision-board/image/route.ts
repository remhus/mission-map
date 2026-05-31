export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const rows = await sql`
    SELECT image_url FROM vision_board_images WHERE id = ${id} AND user_id = ${user.userId}
  `;
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const imageUrl = (rows[0] as { image_url: string }).image_url;
  const match = imageUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return NextResponse.json({ error: 'Invalid image data' }, { status: 500 });

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
