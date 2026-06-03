export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';

export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [tasks, weekCompletions] = await Promise.all([
    sql`SELECT * FROM tasks WHERE user_id = ${user.userId} ORDER BY every_day DESC, day_of_week, time_of_day NULLS LAST`,
    sql`SELECT task_id, completed_date::text AS completed_date FROM task_completions WHERE user_id = ${user.userId} AND completed_date >= CURRENT_DATE - INTERVAL '8 days'`,
  ]);
  return NextResponse.json({ tasks, weekCompletions });
}

const VALID_SKILLS = new Set(['energy','intelligence','strength','bravery','wealth','discipline','wisdom','influence']);

export async function POST(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, skill, duration_minutes, time_of_day, day_of_week, every_day } = await req.json();
  if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
    return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
  }
  if (!VALID_SKILLS.has(skill)) {
    return NextResponse.json({ error: 'Invalid skill' }, { status: 400 });
  }
  const dur = Number(duration_minutes);
  if (!Number.isInteger(dur) || dur < 1 || dur > 480) {
    return NextResponse.json({ error: 'Invalid duration (1–480 minutes)' }, { status: 400 });
  }
  const [task] = await sql`
    INSERT INTO tasks (user_id, title, skill, duration_minutes, time_of_day, day_of_week, every_day)
    VALUES (${user.userId}, ${title}, ${skill}, ${duration_minutes || 30}, ${time_of_day || null}, ${day_of_week ?? 0}, ${every_day || false})
    RETURNING *
  `;
  return NextResponse.json({ task });
}

export async function PUT(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, title, skill, duration_minutes, time_of_day, day_of_week, every_day } = await req.json();
  if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
    return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
  }
  if (!VALID_SKILLS.has(skill)) {
    return NextResponse.json({ error: 'Invalid skill' }, { status: 400 });
  }
  await sql`
    UPDATE tasks
    SET title = ${title}, skill = ${skill}, duration_minutes = ${duration_minutes},
        time_of_day = ${time_of_day || null}, day_of_week = ${day_of_week ?? 0},
        every_day = ${every_day || false}
    WHERE id = ${id} AND user_id = ${user.userId}
  `;
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await sql`DELETE FROM tasks WHERE id = ${id} AND user_id = ${user.userId}`;
  return NextResponse.json({ success: true });
}
