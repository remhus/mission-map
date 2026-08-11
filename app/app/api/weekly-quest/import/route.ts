export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';
import { RANKS, validateQuest, weekStartFor, type GeneratedQuest, type Rank } from '@/lib/weeklyQuest';
import { fetchContext, storeManualBoard, shapeQuest, type QuestRow } from '@/lib/weeklyQuestServer';

// Parse a pasted LLM response into up to four quests keyed by rank.
function parseInput(text: unknown): Record<string, unknown> {
  if (typeof text !== 'string') throw new Error('Paste the JSON response as text.');
  let cleaned = text.trim();
  // Strip ```json ... ``` fences if present.
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  let data: unknown;
  try { data = JSON.parse(cleaned); }
  catch { throw new Error('That is not valid JSON. Paste the raw JSON array the model returned.'); }

  const byRank: Record<string, unknown> = {};
  const list = Array.isArray(data) ? data
    : (data && typeof data === 'object' && Array.isArray((data as { quests?: unknown[] }).quests)) ? (data as { quests: unknown[] }).quests
    : null;

  if (list) {
    for (const item of list) {
      const r = String((item as { rank?: unknown })?.rank || '').toUpperCase();
      if (RANKS.includes(r as Rank)) byRank[r] = item;
    }
  } else if (data && typeof data === 'object') {
    // Object keyed by rank, e.g. { "C": {...}, "B": {...} }.
    for (const r of RANKS) if ((data as Record<string, unknown>)[r]) byRank[r] = (data as Record<string, unknown>)[r];
  }
  return byRank;
}

export async function POST(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { text } = await req.json().catch(() => ({}));

  let byRank: Record<string, unknown>;
  try { byRank = parseInput(text); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }

  const missing = RANKS.filter(r => !byRank[r]);
  if (missing.length) {
    return NextResponse.json({ error: `Missing a quest for rank ${missing.join(', ')}. The response must include all four ranks (C, B, A, S).` }, { status: 400 });
  }

  const ctx = await fetchContext(user.userId);
  const history = { taskHistory: ctx.taskHistory, questHistory: ctx.questHistory };

  const quests: GeneratedQuest[] = [];
  const errors: string[] = [];
  for (const rank of RANKS) {
    const res = validateQuest(byRank[rank], rank as Rank, ctx.hierarchy, history, { allowDuplicates: true });
    if (res.ok) quests.push(res.quest);
    else errors.push(`Rank ${rank}: ${res.reason.replace(/_/g, ' ')}`);
  }
  if (errors.length) {
    return NextResponse.json({ error: 'Some quests were invalid.', details: errors }, { status: 400 });
  }

  const weekStart = weekStartFor();

  // Reset this week's board and enable the feature, then insert the imported set.
  await sql`DELETE FROM weekly_quests WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date`;
  await sql`
    INSERT INTO user_settings (user_id, weekly_quests_enabled, updated_at)
    VALUES (${user.userId}, TRUE, NOW())
    ON CONFLICT (user_id) DO UPDATE SET weekly_quests_enabled = TRUE, updated_at = NOW()
  `;
  await storeManualBoard(user.userId, weekStart, 1, quests);

  const rows = await sql`
    SELECT * FROM weekly_quests
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date AND version = 1 AND status = 'offered'
  ` as QuestRow[];
  const order = (r: string) => RANKS.indexOf(r as Rank);
  return NextResponse.json({
    offers: rows.sort((a, b) => order((a as unknown as { rank: string }).rank) - order((b as unknown as { rank: string }).rank)).map(shapeQuest),
  });
}
