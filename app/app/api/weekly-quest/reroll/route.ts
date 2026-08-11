export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { weekStartFor, gridReadiness, RANKS, type Rank } from '@/lib/weeklyQuest';
import { fetchContext, runGeneration, storeGeneratedQuest, shapeQuest, type QuestRow } from '@/lib/weeklyQuestServer';

// Reforge the board: retire the current offers and generate a fresh set of
// four. Allowed any number of times until a quest is accepted.
export async function POST() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [settings] = await sql`
    SELECT weekly_quests_enabled FROM user_settings WHERE user_id = ${user.userId}
  ` as { weekly_quests_enabled: boolean }[];
  if (settings?.weekly_quests_enabled !== true) {
    return NextResponse.json({ error: 'Weekly quests are not enabled' }, { status: 403 });
  }
  if (!(await checkRateLimit(`wq-gen:${user.userId}`, 40, 3600))) {
    return NextResponse.json({ error: 'Too many requests — wait a moment' }, { status: 429 });
  }

  const weekStart = weekStartFor();

  // Cannot reforge once a quest is chosen.
  const [locked] = await sql`
    SELECT id FROM weekly_quests
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date AND status IN ('active', 'completed')
    LIMIT 1
  ` as { id: number }[];
  if (locked) return NextResponse.json({ error: 'A quest is already active' }, { status: 409 });

  const ctx = await fetchContext(user.userId);
  if (gridReadiness(ctx.hierarchy) === 'empty') {
    return NextResponse.json({ error: 'insufficient_grid' }, { status: 422 });
  }

  // Next board version = one past the highest existing for this week.
  const [max] = await sql`
    SELECT COALESCE(MAX(version), 0) AS v FROM weekly_quests
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date
  ` as { v: number }[];
  const version = Number(max.v) + 1;

  // Claim the four rank rows for the new board (unique index guards races).
  const [claim] = await sql`
    INSERT INTO weekly_quests (user_id, week_start, version, status, rank, created_at)
    VALUES
      (${user.userId}, ${weekStart}::date, ${version}, 'generating', 'C', NOW()),
      (${user.userId}, ${weekStart}::date, ${version}, 'generating', 'B', NOW()),
      (${user.userId}, ${weekStart}::date, ${version}, 'generating', 'A', NOW()),
      (${user.userId}, ${weekStart}::date, ${version}, 'generating', 'S', NOW())
    ON CONFLICT (user_id, week_start, version, rank) DO NOTHING
    RETURNING id
  ` as { id: number }[];
  if (!claim) return NextResponse.json({ generating: true }, { status: 202 });

  const results = await Promise.all(RANKS.map(r => runGeneration(r as Rank, ctx)));
  await Promise.all(results.map(res => storeGeneratedQuest(user.userId, weekStart, version, res)));

  // Retire every older still-offered board.
  await sql`
    UPDATE weekly_quests SET status = 'superseded'
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date AND version < ${version} AND status = 'offered'
  `;

  const rows = await sql`
    SELECT * FROM weekly_quests
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date AND version = ${version} AND status = 'offered'
  ` as QuestRow[];
  const order = (r: string) => RANKS.indexOf(r as Rank);
  return NextResponse.json({ offers: rows.sort((a, b) => order((a as unknown as { rank: string }).rank) - order((b as unknown as { rank: string }).rank)).map(shapeQuest) });
}
