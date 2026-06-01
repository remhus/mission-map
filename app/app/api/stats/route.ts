export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';

export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`
    SELECT skill, points FROM skill_stats WHERE user_id = ${user.userId}
  `;

  const allSkills = ['energy','intelligence','strength','bravery','wealth','discipline','wisdom','influence'];
  const statsMap: Record<string, number> = {};
  allSkills.forEach(s => statsMap[s] = 0);

  // points column stores total minutes. 1 XP = 1 hour (60 min). Cap at 1000 XP (1000 hrs).
  (rows as { skill: string; points: number }[]).forEach(r => {
    statsMap[r.skill] = Math.min(1000, Math.floor(r.points / 60));
  });

  return NextResponse.json({ stats: statsMap });
}

// POST /api/stats — rebuild skill_stats from task_completions history (fixes double-counted XP)
export async function POST(_req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await sql`DELETE FROM skill_stats WHERE user_id = ${user.userId}`;
  await sql`
    INSERT INTO skill_stats (user_id, skill, points)
    SELECT user_id, skill, LEAST(60000, SUM(duration_minutes))
    FROM task_completions
    WHERE user_id = ${user.userId}
    GROUP BY user_id, skill
  `;
  return NextResponse.json({ success: true });
}

// DELETE /api/stats — zero out all XP
export async function DELETE(_req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await sql`DELETE FROM skill_stats WHERE user_id = ${user.userId}`;
  return NextResponse.json({ success: true });
}

