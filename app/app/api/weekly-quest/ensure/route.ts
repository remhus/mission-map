export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { isRank, weekStartFor, gridReadiness, type Rank } from '@/lib/weeklyQuest';
import { fetchContext, runGeneration, shapeQuest, type QuestRow } from '@/lib/weeklyQuestServer';

const STALE_MINUTES = 5;

// Ensure the current week's quest exists — generate it on first request.
// Concurrency-safe via the UNIQUE(user_id, week_start, version) claim row.
export async function POST(req: NextRequest) {
  await initDB();
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [settings] = await sql`
    SELECT weekly_quests_enabled FROM user_settings WHERE user_id = ${user.userId}
  ` as { weekly_quests_enabled: boolean }[];
  if (settings?.weekly_quests_enabled !== true) {
    return NextResponse.json({ error: 'Weekly quests are not enabled' }, { status: 403 });
  }

  // Modest generation cap: at most a few generation calls per user per hour.
  const allowed = await checkRateLimit(`wq-gen:${user.userId}`, 8, 3600);
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const weekStart = weekStartFor();

  // Current quest for this week, if any.
  const [existing] = await sql`
    SELECT * FROM weekly_quests
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date
      AND status IN ('generating', 'active', 'completed')
    ORDER BY version DESC LIMIT 1
  ` as QuestRow[] & { created_at: string; rank: string }[];

  if (existing) {
    if (existing.status === 'active' || existing.status === 'completed') {
      return NextResponse.json({ quest: shapeQuest(existing) });
    }
    // generating: return 202 while fresh; recover if the claim is stale.
    const ageMin = (Date.now() - new Date((existing as unknown as { created_at: string }).created_at).getTime()) / 60000;
    if (ageMin < STALE_MINUTES) {
      return NextResponse.json({ generating: true }, { status: 202 });
    }
  }

  const ctx = await fetchContext(user.userId);
  if (gridReadiness(ctx.hierarchy) === 'empty') {
    return NextResponse.json({ error: 'insufficient_grid' }, { status: 422 });
  }

  let rank: Rank;
  let claimId: number;

  if (existing && existing.status === 'generating') {
    // Recover a stale claim at its stored rank.
    rank = existing.rank as Rank;
    claimId = existing.id;
  } else {
    if (!isRank(body.rank)) {
      return NextResponse.json({ error: 'A valid rank (C, B, A or S) is required' }, { status: 400 });
    }
    rank = body.rank;
    const [claim] = await sql`
      INSERT INTO weekly_quests (user_id, week_start, version, status, rank, created_at)
      VALUES (${user.userId}, ${weekStart}::date, 1, 'generating', ${rank}, NOW())
      ON CONFLICT (user_id, week_start, version) DO NOTHING
      RETURNING id
    ` as { id: number }[];
    if (!claim) {
      // Lost the race to a concurrent request — it is generating.
      return NextResponse.json({ generating: true }, { status: 202 });
    }
    claimId = claim.id;
  }

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
    WHERE id = ${claimId} AND user_id = ${user.userId}
    RETURNING *
  ` as QuestRow[];

  return NextResponse.json({ quest: shapeQuest(saved) });
}
