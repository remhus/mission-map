export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
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

  // points column stores total minutes earned. Convert to hours for display. Cap at 1000.
  (rows as { skill: string; points: number }[]).forEach(r => {
    statsMap[r.skill] = Math.min(1000, Math.floor(r.points / 60));
  });

  return NextResponse.json({ stats: statsMap });
}

