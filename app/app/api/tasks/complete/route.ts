import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, is_completed } = await req.json();

  const [task] = await sql`SELECT * FROM tasks WHERE id = ${id} AND user_id = ${user.userId}`;
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await sql`
    UPDATE tasks SET is_completed = ${is_completed}, completed_at = ${is_completed ? new Date() : null}
    WHERE id = ${id} AND user_id = ${user.userId}
  `;

  const minsEarned = task.duration_minutes || 30;

  if (is_completed) {
    // Record in history (idempotent — unique constraint prevents duplicates)
    await sql`
      INSERT INTO task_completions (user_id, task_id, task_title, skill, duration_minutes, completed_date)
      VALUES (${user.userId}, ${task.id}, ${task.title}, ${task.skill}, ${minsEarned}, CURRENT_DATE)
      ON CONFLICT (user_id, task_id, completed_date) DO NOTHING
    `;
    // Award XP
    if (task.skill) {
      await sql`
        INSERT INTO skill_stats (user_id, skill, points)
        VALUES (${user.userId}, ${task.skill}, ${minsEarned})
        ON CONFLICT (user_id, skill)
        DO UPDATE SET points = LEAST(60000, skill_stats.points + ${minsEarned}), updated_at = NOW()
      `;
    }
  } else {
    // Remove today's completion record
    await sql`
      DELETE FROM task_completions
      WHERE user_id = ${user.userId} AND task_id = ${task.id} AND completed_date = CURRENT_DATE
    `;
    // Deduct XP if it was earned today
    if (task.skill && task.is_completed) {
      await sql`
        UPDATE skill_stats SET points = GREATEST(0, points - ${minsEarned})
        WHERE user_id = ${user.userId} AND skill = ${task.skill}
      `;
    }
  }

  return NextResponse.json({ success: true });
}
