import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';

export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tasks = await sql`
    SELECT * FROM tasks WHERE user_id = ${user.userId} ORDER BY every_day DESC, day_of_week, time_of_day NULLS LAST
  `;
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, skill, duration_minutes, time_of_day, day_of_week, every_day } = await req.json();
  const [task] = await sql`
    INSERT INTO tasks (user_id, title, skill, duration_minutes, time_of_day, day_of_week, every_day)
    VALUES (${user.userId}, ${title}, ${skill}, ${duration_minutes || 30}, ${time_of_day || null}, ${day_of_week ?? 0}, ${every_day || false})
    RETURNING *
  `;
  return NextResponse.json({ task });
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, title, skill, duration_minutes, time_of_day, day_of_week, every_day } = await req.json();
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
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await sql`DELETE FROM tasks WHERE id = ${id} AND user_id = ${user.userId}`;
  return NextResponse.json({ success: true });
}
