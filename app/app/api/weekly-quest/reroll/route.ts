export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { weekStartFor, RANKS, type Rank } from '@/lib/weeklyQuest';
import { fetchContext, runGeneration, storeGeneratedQuest, shapeQuest, type QuestRow } from '@/lib/weeklyQuestServer';

// Reforge the board once per week: retire the version-1 offers and generate a
// fresh set of four. Only allowed before a quest has been accepted.
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
  if (!(await checkRateLimit(`wq-gen:${user.userId}`, 16, 3600))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const weekStart = weekStartFor();

  // Cannot reforge once a quest is chosen.
  const [locked] = await sql`
    SELECT id FROM weekly_quests
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date AND status IN ('active', 'completed')
    LIMIT 1
  ` as { id: number }[];
  if (locked) return NextResponse.json({ error: 'A quest is already active' }, { status: 409 });

  // Reforge only the first board.
  const [v1] = await sql`
    SELECT id FROM weekly_quests
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date AND version = 1 AND status = 'offered'
    LIMIT 1
  ` as { id: number }[];
  if (!v1) return NextResponse.json({ error: 'Reforge is not available' }, { status: 409 });

  // Claim version 2 — the unique index prevents a double reforge.
  const [claim] = await sql`
    INSERT INTO weekly_quests (user_id, week_start, version, status, rank, created_at)
    VALUES
      (${user.userId}, ${weekStart}::date, 2, 'generating', 'C', NOW()),
      (${user.userId}, ${weekStart}::date, 2, 'generating', 'B', NOW()),
      (${user.userId}, ${weekStart}::date, 2, 'generating', 'A', NOW()),
      (${user.userId}, ${weekStart}::date, 2, 'generating', 'S', NOW())
    ON CONFLICT (user_id, week_start, version, rank) DO NOTHING
    RETURNING id
  ` as { id: number }[];
  if (!claim) {
    // Version 2 already exists — reforge already used.
    const rows = await sql`
      SELECT * FROM weekly_quests
      WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date AND version = 2 AND status = 'offered'
    ` as QuestRow[];
    if (rows.length) {
      const order = (r: string) => RANKS.indexOf(r as Rank);
      return NextResponse.json({ offers: rows.sort((a, b) => order((a as unknown as { rank: string }).rank) - order((b as unknown as { rank: string }).rank)).map(shapeQuest) });
    }
    return NextResponse.json({ generating: true }, { status: 202 });
  }

  const ctx = await fetchContext(user.userId);
  const results = await Promise.all(RANKS.map(r => runGeneration(r as Rank, ctx)));
  await Promise.all(results.map(res => storeGeneratedQuest(user.userId, weekStart, 2, res)));

  // Retire the version-1 offers once the new board is stored.
  await sql`
    UPDATE weekly_quests SET status = 'superseded'
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date AND version = 1 AND status = 'offered'
  `;

  const rows = await sql`
    SELECT * FROM weekly_quests
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date AND version = 2 AND status = 'offered'
  ` as QuestRow[];
  const order = (r: string) => RANKS.indexOf(r as Rank);
  return NextResponse.json({ offers: rows.sort((a, b) => order((a as unknown as { rank: string }).rank) - order((b as unknown as { rank: string }).rank)).map(shapeQuest) });
}
