export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';
import { isRank, weekStartFor } from '@/lib/weeklyQuest';
import { shapeQuest, type QuestRow } from '@/lib/weeklyQuestServer';

// Accept one quest from the board. That rank becomes the week's active quest;
// its siblings are declined. Locks the week's choice.
export async function POST(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rank } = await req.json().catch(() => ({}));
  if (!isRank(rank)) return NextResponse.json({ error: 'A valid rank is required' }, { status: 400 });

  const weekStart = weekStartFor();

  // If a quest is already active/completed this week, selection is locked.
  const [already] = await sql`
    SELECT * FROM weekly_quests
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date AND status IN ('active', 'completed')
    ORDER BY version DESC LIMIT 1
  ` as QuestRow[];
  if (already) {
    return NextResponse.json({ quest: shapeQuest(already), alreadyChosen: true });
  }

  // Newest board version that still has offers.
  const [board] = await sql`
    SELECT version FROM weekly_quests
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date AND status = 'offered'
    ORDER BY version DESC LIMIT 1
  ` as { version: number }[];
  if (!board) return NextResponse.json({ error: 'No board to choose from' }, { status: 409 });

  // Atomically claim the chosen rank.
  const [chosen] = await sql`
    UPDATE weekly_quests SET status = 'active'
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date
      AND version = ${board.version} AND rank = ${rank} AND status = 'offered'
    RETURNING *
  ` as QuestRow[];
  if (!chosen) return NextResponse.json({ error: 'That quest is no longer available' }, { status: 409 });

  // Decline the rest of the board.
  await sql`
    UPDATE weekly_quests SET status = 'declined'
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date
      AND version = ${board.version} AND status = 'offered'
  `;

  return NextResponse.json({ quest: shapeQuest(chosen) });
}
