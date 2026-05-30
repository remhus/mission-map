import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';

export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const completions = await sql`
    SELECT id, task_id, task_title, skill, duration_minutes,
           completed_date::text AS completed_date, created_at
    FROM task_completions
    WHERE user_id = ${user.userId}
    ORDER BY completed_date DESC, created_at DESC
  `;

  return NextResponse.json({ completions });
}
