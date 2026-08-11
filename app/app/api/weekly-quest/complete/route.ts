export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';
import { SKILLS, type Skill } from '@/lib/weeklyQuest';

// Complete the active quest: mark it done and award the stored skill XP once.
// Idempotent — the status transition only fires on the first request, so XP is
// never awarded twice under retries or refreshes.
export async function POST(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'Quest id required' }, { status: 400 });

  // Atomic claim of the completion: only an 'active' row transitions.
  const [completed] = await sql`
    UPDATE weekly_quests SET status = 'completed', completed_at = NOW()
    WHERE id = ${id} AND user_id = ${user.userId} AND status = 'active'
    RETURNING skill_xp
  ` as { skill_xp: Record<string, number> }[];

  if (!completed) {
    // Already completed or not active — return current state without re-awarding.
    const [row] = await sql`
      SELECT status, skill_xp FROM weekly_quests WHERE id = ${id} AND user_id = ${user.userId}
    ` as { status: string; skill_xp: Record<string, number> }[];
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      completed: row.status === 'completed',
      awarded: row.skill_xp || {},
      alreadyCompleted: true,
    });
  }

  const xp = completed.skill_xp || {};
  // Award each non-zero skill as points into skill_stats (same store the radar reads).
  for (const s of SKILLS as readonly Skill[]) {
    const amount = Math.max(0, Math.floor(Number(xp[s]) || 0));
    if (amount <= 0) continue;
    await sql`
      INSERT INTO skill_stats (user_id, skill, points)
      VALUES (${user.userId}, ${s}, ${amount})
      ON CONFLICT (user_id, skill)
      DO UPDATE SET points = LEAST(60000, skill_stats.points + ${amount}), updated_at = NOW()
    `;
  }

  return NextResponse.json({ completed: true, awarded: xp, alreadyCompleted: false });
}
