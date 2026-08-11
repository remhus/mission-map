export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';
import { buildHierarchy, gridReadiness, weekStartFor, weekRangeLabel, RANKS } from '@/lib/weeklyQuest';
import { shapeQuest, type QuestRow } from '@/lib/weeklyQuestServer';

// Read-only current-week snapshot the Quest Board renders from.
export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const weekStart = weekStartFor();

  const [settingsRow, cells, rows] = await Promise.all([
    sql`SELECT weekly_quests_enabled, timezone FROM user_settings WHERE user_id = ${user.userId}`,
    sql`SELECT row_index, col_index, content FROM grid_cells WHERE user_id = ${user.userId}`,
    sql`
      SELECT * FROM weekly_quests
      WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date
      ORDER BY version DESC, id ASC
    `,
  ]);

  const settings = (settingsRow as { weekly_quests_enabled: boolean; timezone: string }[])[0];
  const enabled = settings?.weekly_quests_enabled === true;

  const hierarchy = buildHierarchy(cells as { row_index: number; col_index: number; content: string }[]);
  const gridReady = gridReadiness(hierarchy);

  const all = rows as (QuestRow & { version: number; status: string; rank: string })[];

  // A chosen quest (active or completed) takes precedence over the board.
  const chosen = all.find(r => r.status === 'active' || r.status === 'completed') || null;

  // Otherwise show the newest board's offered quests.
  const latestVersion = all.length ? Math.max(...all.map(r => r.version)) : 0;
  const offered = all.filter(r => r.version === latestVersion && r.status === 'offered');
  const generatingRows = all.filter(r => r.version === latestVersion && r.status === 'generating');

  // Order offers C→B→A→S.
  const rankOrder = (r: string) => RANKS.indexOf(r as (typeof RANKS)[number]);
  offered.sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank));

  return NextResponse.json({
    enabled,
    timezone: settings?.timezone || 'Europe/London',
    weekStart,
    weekLabel: weekRangeLabel(weekStart),
    gridReady,
    boardVersion: latestVersion,
    generating: !chosen && generatingRows.length > 0,
    rerollAvailable: !chosen && offered.length > 0,
    offers: !chosen && offered.length > 0 ? offered.map(shapeQuest) : null,
    quest: chosen ? shapeQuest(chosen) : null,
  });
}
