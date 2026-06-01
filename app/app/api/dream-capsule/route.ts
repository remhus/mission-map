export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';
import { sanitizeRichHtml } from '@/lib/sanitize';

export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`
    SELECT * FROM dream_capsules WHERE user_id = ${user.userId} ORDER BY created_at DESC LIMIT 1
  `;
  if (!rows.length) return NextResponse.json({ capsule: null });

  const capsule = rows[0] as {
    id: number; content: string; is_sealed: boolean;
    sealed_at: string | null; locked_until: string | null; created_at: string;
  };
  const isUnlocked = !capsule.is_sealed || !capsule.locked_until || new Date(capsule.locked_until) <= new Date();
  return NextResponse.json({
    capsule: { ...capsule, content: isUnlocked ? capsule.content : null },
  });
}

export async function POST(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { content } = await req.json();
  const safeContent = sanitizeRichHtml(content || '');
  const [capsule] = await sql`
    INSERT INTO dream_capsules (user_id, content, is_sealed)
    VALUES (${user.userId}, ${safeContent}, false)
    RETURNING *
  `;
  return NextResponse.json({ capsule });
}

export async function DELETE(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (id) {
    await sql`DELETE FROM dream_capsules WHERE id = ${id} AND user_id = ${user.userId}`;
  } else {
    await sql`DELETE FROM dream_capsules WHERE user_id = ${user.userId}`;
  }
  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, content, seal, years } = await req.json();
  const safeUpdateContent = sanitizeRichHtml(content || '');

  if (seal && years) {
    const lockedUntil = new Date();
    lockedUntil.setFullYear(lockedUntil.getFullYear() + years);
    await sql`
      UPDATE dream_capsules
      SET content = ${safeUpdateContent}, is_sealed = true, sealed_at = NOW(), locked_until = ${lockedUntil.toISOString()}, updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.userId} AND is_sealed = false
    `;
  } else {
    await sql`
      UPDATE dream_capsules
      SET content = ${safeUpdateContent}, updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.userId} AND is_sealed = false
    `;
  }
  return NextResponse.json({ success: true });
}
