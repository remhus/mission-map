export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { weekStartFor, type Rank } from '@/lib/weeklyQuest';
import { fetchContext, runGeneration, shapeQuest, type QuestRow } from '@/lib/weeklyQuestServer';

// One reroll per week. Retires version 1 and generates version 2 at the same
// rank. The reroll is only consumed once version 2 is validated and stored.
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

  const allowed = await checkRateLimit(`wq-gen:${user.userId}`, 8, 3600);
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const weekStart = weekStartFor();

  // Reroll requires an active, incomplete version 1.
  const [v1] = await sql`
    SELECT * FROM weekly_quests
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date AND version = 1 AND status = 'active'
    LIMIT 1
  ` as QuestRow[] & { rank: string }[];
  if (!v1) {
    return NextResponse.json({ error: 'Reroll is not available' }, { status: 409 });
  }

  const rank = v1.rank as Rank;

  // Claim version 2 — the unique constraint prevents a double reroll.
  const [claim] = await sql`
    INSERT INTO weekly_quests (user_id, week_start, version, status, rank, created_at)
    VALUES (${user.userId}, ${weekStart}::date, 2, 'generating', ${rank}, NOW())
    ON CONFLICT (user_id, week_start, version) DO NOTHING
    RETURNING id
  ` as { id: number }[];

  if (!claim) {
    // Version 2 already exists — reroll was already used.
    const [existing2] = await sql`
      SELECT * FROM weekly_quests
      WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date AND version = 2
      ORDER BY id DESC LIMIT 1
    ` as QuestRow[];
    if (existing2?.status === 'generating') return NextResponse.json({ generating: true }, { status: 202 });
    if (existing2?.status === 'active' || existing2?.status === 'completed') {
      return NextResponse.json({ quest: shapeQuest(existing2) });
    }
    return NextResponse.json({ error: 'Reroll already used' }, { status: 409 });
  }

  const ctx = await fetchContext(user.userId);
  const result = await runGeneration(rank, ctx);
  const q = result.quest;

  const [saved] = await sql`
    UPDATE weekly_quests SET
      status = 'active',
      title = ${q.title},
      instructions = ${q.instructions},
      success_criteria = ${q.successCriteria},
      rationale = ${q.rationale},
      skill_xp = ${JSON.stringify(q.skillXp)}::jsonb,
      duration_minutes = ${q.durationMinutes},
      source_row_index = ${q.sourceRowIndex},
      source_col_index = ${q.sourceColIndex},
      source_pillar = ${q.sourcePillar},
      provider = ${result.provider},
      model = ${result.model},
      failure_code = ${result.failureCode},
      generated_at = NOW()
    WHERE id = ${claim.id} AND user_id = ${user.userId}
    RETURNING *
  ` as QuestRow[];

  // Retire version 1 only after version 2 is stored.
  await sql`
    UPDATE weekly_quests SET status = 'superseded'
    WHERE id = ${v1.id} AND user_id = ${user.userId} AND status = 'active'
  `;

  return NextResponse.json({ quest: shapeQuest(saved) });
}
