export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import sql, { initDB } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { weekStartFor, gridReadiness, RANKS, type Rank } from '@/lib/weeklyQuest';
import { fetchContext, runGeneration, storeGeneratedQuest, shapeQuest, assignFocus, type QuestRow } from '@/lib/weeklyQuestServer';

const STALE_MINUTES = 5;

// Generate the full Quest Board — one boss fight per rank (C/B/A/S) — on the
// first request of the week. Concurrency-safe via the per-(week,version,rank)
// unique claim rows.
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

  // A board is 4 calls; a reroll is 4 more. Cap generously per hour.
  if (!(await checkRateLimit(`wq-gen:${user.userId}`, 16, 3600))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const weekStart = weekStartFor();
  const rows = await sql`
    SELECT id, version, status, rank, created_at FROM weekly_quests
    WHERE user_id = ${user.userId} AND week_start = ${weekStart}::date
    ORDER BY version DESC
  ` as { id: number; version: number; status: string; rank: string; created_at: string }[];

  // Already chosen or already generated → return current state.
  const chosen = rows.find(r => r.status === 'active' || r.status === 'completed');
  if (chosen) {
    const [full] = await sql`SELECT * FROM weekly_quests WHERE id = ${chosen.id}` as QuestRow[];
    return NextResponse.json({ quest: shapeQuest(full) });
  }
  const latestVersion = rows.length ? Math.max(...rows.map(r => r.version)) : 0;
  const offered = rows.filter(r => r.version === latestVersion && r.status === 'offered');
  if (offered.length > 0) return NextResponse.json({ offers: await loadOffers(user.userId, weekStart, latestVersion) });

  const generating = rows.filter(r => r.version === latestVersion && r.status === 'generating');
  let version = 1;
  if (generating.length > 0) {
    const ageMin = (Date.now() - new Date(generating[0].created_at).getTime()) / 60000;
    if (ageMin < STALE_MINUTES) return NextResponse.json({ generating: true }, { status: 202 });
    version = latestVersion; // recover the stale claim at its version
  }

  const ctx = await fetchContext(user.userId);
  if (gridReadiness(ctx.hierarchy) === 'empty') {
    return NextResponse.json({ error: 'insufficient_grid' }, { status: 422 });
  }

  if (version === 1 && generating.length === 0) {
    // Fresh board: claim all four rank rows atomically.
    const [claimed] = await sql`
      INSERT INTO weekly_quests (user_id, week_start, version, status, rank, created_at)
      VALUES
        (${user.userId}, ${weekStart}::date, 1, 'generating', 'C', NOW()),
        (${user.userId}, ${weekStart}::date, 1, 'generating', 'B', NOW()),
        (${user.userId}, ${weekStart}::date, 1, 'generating', 'A', NOW()),
        (${user.userId}, ${weekStart}::date, 1, 'generating', 'S', NOW())
      ON CONFLICT (user_id, week_start, version, rank) DO NOTHING
      RETURNING id
    ` as { id: number }[];
    if (!claimed) {
      // Lost the race — another request is generating this board.
      return NextResponse.json({ generating: true }, { status: 202 });
    }
  }

  // Generate all four ranks in parallel — each pinned to a different pillar/
  // sub-cell so the board covers the grid rather than repeating one area.
  const focus = assignFocus(ctx, RANKS);
  const results = await Promise.all(RANKS.map((r, i) => runGeneration(r as Rank, ctx, focus[i])));
  await Promise.all(results.map(res => storeGeneratedQuest(user.userId, weekStart, version, res)));

  return NextResponse.json({ offers: await loadOffers(user.userId, weekStart, version) });
}

async function loadOffers(userId: string, weekStart: string, version: number) {
  const rows = await sql`
    SELECT * FROM weekly_quests
    WHERE user_id = ${userId} AND week_start = ${weekStart}::date AND version = ${version} AND status = 'offered'
  ` as QuestRow[];
  const order = (r: string) => RANKS.indexOf(r as Rank);
  return rows
    .sort((a, b) => order((a as unknown as { rank: string }).rank) - order((b as unknown as { rank: string }).rank))
    .map(shapeQuest);
}
