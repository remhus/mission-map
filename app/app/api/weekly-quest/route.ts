export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';
import { buildHierarchy, gridReadiness, weekStartFor, weekRangeLabel } from '@/lib/weeklyQuest';
import { shapeQuest, type QuestRow } from '@/lib/weeklyQuestServer';

// Read-only current-week snapshot the Quests page renders from.
export async function GET() {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const weekStart = weekStartFor();

  const [settingsRow, cells, questRows] = await Promise.all([
    sql`SELECT weekly_quests_enabled, timezone FROM user_settings WHERE user_id = ${user.userId}`,
    sql`SELECT row_index, col_index, content FROM grid_cells WHERE user_id = ${user.userId}`,
    sql`
      SELECT * FROM weekly_quests
      WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date
        AND status IN ('generating', 'active', 'completed')
      ORDER BY version DESC LIMIT 1
    `,
  ]);

  const settings = (settingsRow as { weekly_quests_enabled: boolean; timezone: string }[])[0];
  const enabled = settings?.weekly_quests_enabled === true;

  const hierarchy = buildHierarchy(
    (cells as { row_index: number; col_index: number; content: string }[]),
  );
  const gridReady = gridReadiness(hierarchy);

  const current = (questRows as QuestRow[])[0] || null;
  const generating = current?.status === 'generating';
  const rerollAvailable = !!current && current.version === 1 && current.status === 'active';

  return NextResponse.json({
    enabled,
    timezone: settings?.timezone || 'Europe/London',
    weekStart,
    weekLabel: weekRangeLabel(weekStart),
    gridReady,
    generating,
    rerollAvailable,
    quest: current && current.status !== 'generating' ? shapeQuest(current) : null,
  });
}
