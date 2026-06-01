export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';

export async function POST(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, is_completed, target_date } = await req.json();
  // Use the provided date (for retroactive logging) or fall back to today
  const completionDate = target_date || new Date().toISOString().split('T')[0];

  const [task] = await sql`SELECT * FROM tasks WHERE id = ${id} AND user_id = ${user.userId}`;
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const completedAt = is_completed ? new Date(`${completionDate}T12:00:00Z`) : null;
  await sql`
    UPDATE tasks SET is_completed = ${is_completed}, completed_at = ${completedAt}
    WHERE id = ${id} AND user_id = ${user.userId}
  `;

  const minsEarned = task.duration_minutes || 30;

  if (is_completed) {
    // Only award XP if this is a genuinely new completion for this date
    const [inserted] = await sql`
      INSERT INTO task_completions (user_id, task_id, task_title, skill, duration_minutes, completed_date)
      VALUES (${user.userId}, ${task.id}, ${task.title}, ${task.skill}, ${minsEarned}, ${completionDate}::date)
      ON CONFLICT (user_id, task_id, completed_date) DO NOTHING
      RETURNING user_id
    `;
    if (task.skill && inserted) {
      await sql`
        INSERT INTO skill_stats (user_id, skill, points)
        VALUES (${user.userId}, ${task.skill}, ${minsEarned})
        ON CONFLICT (user_id, skill)
        DO UPDATE SET points = LEAST(60000, skill_stats.points + ${minsEarned}), updated_at = NOW()
      `;
    }
  } else {
    // Only deduct XP if a completion record was actually removed
    const [deleted] = await sql`
      DELETE FROM task_completions
      WHERE user_id = ${user.userId} AND task_id = ${task.id} AND completed_date = ${completionDate}::date
      RETURNING user_id
    `;
    if (task.skill && deleted) {
      await sql`
        UPDATE skill_stats SET points = GREATEST(0, points - ${minsEarned})
        WHERE user_id = ${user.userId} AND skill = ${task.skill}
      `;
    }
  }

  return NextResponse.json({ success: true });
}
